import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.main import scheduler
from app.models.notification import Notification
from app.models.parking_reservation import ParkingReservation
from app.models.parking_zone import ParkingZone
from app.models.user import User
from app.services.parking import (
    mark_expired_reservations_no_show,
    process_due_parking_reminders,
)
from app.services.websocket_manager import websocket_manager


class ParkingReminderTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(
            self.engine,
            tables=[
                User.__table__,
                ParkingZone.__table__,
                ParkingReservation.__table__,
                Notification.__table__,
            ],
        )
        self.session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            expire_on_commit=False,
        )
        self.db = self.session_factory()
        self.now = datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc)

        self.db.add_all(
            [
                User(
                    id=1,
                    name="Reminder Test User",
                    email="reminders@example.test",
                    password_hash="test-only",
                    role="STUDENT",
                ),
                ParkingZone(
                    id=1,
                    name="Reminder Test Lot",
                    car_capacity=10,
                    bike_capacity=10,
                    staff_reserved_car=0,
                    staff_reserved_bike=0,
                    lat=Decimal("12.0000000"),
                    lng=Decimal("77.0000000"),
                    status="OPEN",
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_reservation(
        self,
        reservation_id: int,
        status: str,
        requested_arrival_at: datetime,
        arrival_deadline: datetime,
    ) -> ParkingReservation:
        reservation = ParkingReservation(
            id=reservation_id,
            user_id=1,
            parking_zone_id=1,
            vehicle_type="CAR",
            status=status,
            reserved_at=self.now.replace(tzinfo=None),
            requested_arrival_at=requested_arrival_at.replace(tzinfo=None),
            arrival_deadline=arrival_deadline.replace(tzinfo=None),
        )
        self.db.add(reservation)
        return reservation

    def notification_types_by_reservation(self) -> dict[int, set[str]]:
        notifications = self.db.query(Notification).all()
        grouped: dict[int, set[str]] = {}
        for notification in notifications:
            grouped.setdefault(notification.related_id, set()).add(
                notification.type
            )
        return grouped

    def test_due_reminders_and_repeated_run_deduplication(self):
        self.add_reservation(
            1,
            "RESERVED",
            self.now + timedelta(minutes=15),
            self.now + timedelta(minutes=30),
        )
        self.add_reservation(
            2,
            "RESERVED",
            self.now,
            self.now + timedelta(minutes=15),
        )
        self.add_reservation(
            3,
            "RESERVED",
            self.now - timedelta(minutes=10),
            self.now + timedelta(minutes=5),
        )
        self.db.commit()

        with patch.object(websocket_manager, "publish_notification") as publish:
            created_count = process_due_parking_reminders(
                self.db,
                now=self.now,
            )
            self.assertEqual(created_count, 4)

            expected = {
                1: {"RESERVATION_REMINDER"},
                2: {"ARRIVAL_WINDOW_OPEN"},
                3: {"ARRIVAL_WINDOW_OPEN", "EXPIRY_WARNING"},
            }
            self.assertEqual(self.notification_types_by_reservation(), expected)
            self.assertEqual(publish.call_count, 4)

            repeated_count = process_due_parking_reminders(
                self.db,
                now=self.now,
            )

        self.assertEqual(repeated_count, 0)
        self.assertEqual(self.db.query(Notification).count(), 4)

    def test_non_reserved_reservations_do_not_receive_reminders(self):
        due_arrival = self.now
        due_deadline = self.now + timedelta(minutes=5)
        for reservation_id, status in enumerate(
            ("CANCELLED", "ACTIVE", "COMPLETED", "NO_SHOW"),
            start=10,
        ):
            self.add_reservation(
                reservation_id,
                status,
                due_arrival,
                due_deadline,
            )
        self.db.commit()

        created_count = process_due_parking_reminders(
            self.db,
            now=self.now,
        )

        self.assertEqual(created_count, 0)
        self.assertEqual(self.db.query(Notification).count(), 0)

    def test_existing_no_show_processor_and_scheduler_remain_active(self):
        expired = self.add_reservation(
            20,
            "RESERVED",
            self.now - timedelta(minutes=20),
            self.now - timedelta(minutes=5),
        )
        active_expired = self.add_reservation(
            21,
            "ACTIVE",
            self.now - timedelta(minutes=20),
            self.now - timedelta(minutes=5),
        )
        self.db.commit()

        with (
            patch("app.services.parking._utc_now", return_value=self.now),
            patch.object(websocket_manager, "publish_notification") as publish,
        ):
            self.assertEqual(mark_expired_reservations_no_show(self.db), 1)
            self.assertEqual(mark_expired_reservations_no_show(self.db), 0)

        self.db.refresh(expired)
        self.db.refresh(active_expired)
        self.assertEqual(expired.status, "NO_SHOW")
        self.assertEqual(active_expired.status, "ACTIVE")
        no_show_notifications = (
            self.db.query(Notification)
            .filter(
                Notification.related_id == expired.id,
                Notification.type == "NO_SHOW_RELEASED",
            )
            .count()
        )
        self.assertEqual(no_show_notifications, 1)
        self.assertEqual(publish.call_count, 1)

        jobs = {job.id: job for job in scheduler.get_jobs()}
        no_show_job = jobs["parking_no_show_scheduler"]
        self.assertEqual(no_show_job.trigger.interval.total_seconds(), 60)
        self.assertEqual(
            no_show_job.func,
            mark_expired_reservations_no_show,
        )
        self.assertEqual(
            jobs["parking_reminder_scheduler"].trigger.interval.total_seconds(),
            60,
        )


if __name__ == "__main__":
    unittest.main()
