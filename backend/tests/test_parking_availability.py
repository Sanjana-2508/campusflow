import os
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Query, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.notification import Notification
from app.models.parking_reservation import ParkingReservation
from app.models.parking_zone import ParkingZone
from app.models.user import User
from app.services.parking import (
    calculate_available_spaces,
    create_reservation,
)
from app.services.websocket_manager import websocket_manager
from app.schemas.parking_reservation import ParkingReservationCreate


class ParkingAvailabilityTests(unittest.TestCase):
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
                    name="Student One",
                    email="student-one@example.test",
                    password_hash="test-only",
                    role="STUDENT",
                ),
                User(
                    id=2,
                    name="Student Two",
                    email="student-two@example.test",
                    password_hash="test-only",
                    role="STUDENT",
                ),
                User(
                    id=3,
                    name="Faculty One",
                    email="faculty@example.test",
                    password_hash="test-only",
                    role="FACULTY_STAFF",
                ),
                ParkingZone(
                    id=1,
                    name="Mixed Role Lot",
                    car_capacity=5,
                    bike_capacity=4,
                    staff_reserved_car=2,
                    staff_reserved_bike=1,
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
        *,
        reservation_id: int,
        user_id: int,
        vehicle_type: str,
        status: str = "RESERVED",
        requested_arrival_at: datetime | None = None,
        arrival_deadline: datetime | None = None,
        zone_id: int = 1,
    ) -> ParkingReservation:
        start = requested_arrival_at or self.now
        end = arrival_deadline or self.now + timedelta(minutes=15)
        reservation = ParkingReservation(
            id=reservation_id,
            user_id=user_id,
            parking_zone_id=zone_id,
            vehicle_type=vehicle_type,
            status=status,
            reserved_at=self.now.replace(tzinfo=None),
            requested_arrival_at=start.replace(tzinfo=None),
            arrival_deadline=end.replace(tzinfo=None),
        )
        self.db.add(reservation)
        return reservation

    def test_role_and_vehicle_availability_respects_reserved_and_total_capacity(self):
        self.assertEqual(
            calculate_available_spaces(
                self.db, 1, "CAR", "STUDENT", requested_at=self.now
            ),
            3,
        )
        self.assertEqual(
            calculate_available_spaces(
                self.db, 1, "CAR", "FACULTY_STAFF", requested_at=self.now
            ),
            5,
        )
        self.assertEqual(
            calculate_available_spaces(
                self.db, 1, "TWO_WHEELER", "STUDENT", requested_at=self.now
            ),
            3,
        )
        self.assertEqual(
            calculate_available_spaces(
                self.db,
                1,
                "TWO_WHEELER",
                "FACULTY_STAFF",
                requested_at=self.now,
            ),
            4,
        )

    def test_staff_reservations_overflowing_reserved_pool_reduce_student_availability(self):
        self.add_reservation(
            reservation_id=1,
            user_id=3,
            vehicle_type="CAR",
        )
        self.add_reservation(
            reservation_id=2,
            user_id=3,
            vehicle_type="CAR",
        )
        self.add_reservation(
            reservation_id=3,
            user_id=3,
            vehicle_type="CAR",
        )
        self.db.commit()

        self.assertEqual(
            calculate_available_spaces(
                self.db, 1, "CAR", "STUDENT", requested_at=self.now
            ),
            2,
        )
        self.assertEqual(
            calculate_available_spaces(
                self.db, 1, "CAR", "FACULTY_STAFF", requested_at=self.now
            ),
            2,
        )

    def test_student_reservations_reduce_availability_for_both_roles(self):
        self.add_reservation(
            reservation_id=1,
            user_id=1,
            vehicle_type="CAR",
        )
        self.add_reservation(
            reservation_id=2,
            user_id=2,
            vehicle_type="TWO_WHEELER",
        )
        self.db.commit()

        self.assertEqual(
            calculate_available_spaces(
                self.db, 1, "CAR", "STUDENT", requested_at=self.now
            ),
            2,
        )
        self.assertEqual(
            calculate_available_spaces(
                self.db, 1, "CAR", "FACULTY_STAFF", requested_at=self.now
            ),
            4,
        )
        self.assertEqual(
            calculate_available_spaces(
                self.db,
                1,
                "TWO_WHEELER",
                "FACULTY_STAFF",
                requested_at=self.now,
            ),
            3,
        )

    def test_capacity_limit_rejects_the_next_reservation(self):
        limited_zone = ParkingZone(
            id=2,
            name="Single Space Lot",
            car_capacity=1,
            bike_capacity=1,
            staff_reserved_car=0,
            staff_reserved_bike=0,
            lat=Decimal("12.0000000"),
            lng=Decimal("77.0000000"),
            status="OPEN",
        )
        self.db.add(limited_zone)
        self.db.commit()
        request = ParkingReservationCreate(
            parking_zone_id=2,
            vehicle_type="CAR",
            requested_arrival_at=self.now + timedelta(minutes=30),
        )
        self.db.expire_all()
        student_one = self.db.get(User, 1)
        student_two = self.db.get(User, 2)

        with (
            patch("app.services.parking._utc_now", return_value=self.now),
            patch.object(websocket_manager, "publish_notification"),
        ):
            created = create_reservation(self.db, student_one, request)
            self.assertEqual(created.status, "RESERVED")
            with self.assertRaises(HTTPException) as raised:
                create_reservation(self.db, student_two, request)

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(
            self.db.query(ParkingReservation)
            .filter(ParkingReservation.parking_zone_id == 2)
            .count(),
            1,
        )

    def test_create_reservation_uses_mysql_for_update_and_competing_attempts_serialize(self):
        zone_query_sql = str(
            select(ParkingZone)
            .where(ParkingZone.id == 2)
            .with_for_update()
            .compile(dialect=mysql.dialect())
        )
        reservation_query_sql = str(
            self.db.query(ParkingReservation, User.role)
            .join(User, User.id == ParkingReservation.user_id)
            .filter(
                ParkingReservation.parking_zone_id == 2,
                ParkingReservation.vehicle_type == "CAR",
                ParkingReservation.status.in_(("RESERVED", "ACTIVE")),
            )
            .with_for_update()
            .statement.compile(dialect=mysql.dialect())
        )
        self.assertIn("FOR UPDATE", zone_query_sql.upper())
        self.assertIn("FOR UPDATE", reservation_query_sql.upper())

        zone = ParkingZone(
            id=2,
            name="Concurrent Lot",
            car_capacity=1,
            bike_capacity=1,
            staff_reserved_car=0,
            staff_reserved_bike=0,
            lat=Decimal("12.0000000"),
            lng=Decimal("77.0000000"),
            status="OPEN",
        )
        self.db.add(zone)
        self.db.commit()
        self.db.close()

        handle, database_path = tempfile.mkstemp(suffix=".sqlite")
        os.close(handle)
        concurrent_engine = create_engine(
            f"sqlite:///{database_path}",
            connect_args={"check_same_thread": False},
        )
        Base.metadata.create_all(
            concurrent_engine,
            tables=[
                User.__table__,
                ParkingZone.__table__,
                ParkingReservation.__table__,
                Notification.__table__,
            ],
        )
        concurrent_factory = sessionmaker(
            bind=concurrent_engine,
            autoflush=False,
            expire_on_commit=False,
        )
        setup_session = concurrent_factory()
        setup_session.add_all(
            [
                User(
                    id=1,
                    name="Concurrent Student One",
                    email="concurrent-one@example.test",
                    password_hash="test-only",
                    role="STUDENT",
                ),
                User(
                    id=2,
                    name="Concurrent Student Two",
                    email="concurrent-two@example.test",
                    password_hash="test-only",
                    role="STUDENT",
                ),
                ParkingZone(
                    id=2,
                    name="Concurrent Lot",
                    car_capacity=1,
                    bike_capacity=1,
                    staff_reserved_car=0,
                    staff_reserved_bike=0,
                    lat=Decimal("12.0000000"),
                    lng=Decimal("77.0000000"),
                    status="OPEN",
                ),
            ]
        )
        setup_session.commit()
        setup_session.close()

        row_lock = threading.Lock()
        simultaneous_start = threading.Barrier(2)
        lock_calls = []
        outcomes = []
        outcomes_lock = threading.Lock()
        original_with_for_update = Query.with_for_update
        original_commit = Session.commit
        original_rollback = Session.rollback
        original_close = Session.close

        def serialized_with_for_update(query, *args, **kwargs):
            model = query.column_descriptions[0].get("entity")
            if model is not ParkingZone:
                return original_with_for_update(query, *args, **kwargs)
            row_lock.acquire()
            query.session.info["test_row_lock_held"] = True
            lock_calls.append(query.session)
            return original_with_for_update(query, *args, **kwargs)

        def release_lock(session):
            if session.info.pop("test_row_lock_held", False):
                row_lock.release()

        def commit_and_release(session):
            try:
                return original_commit(session)
            finally:
                release_lock(session)

        def rollback_and_release(session):
            try:
                return original_rollback(session)
            finally:
                release_lock(session)

        def close_and_release(session):
            try:
                return original_close(session)
            finally:
                release_lock(session)

        def attempt(user_id: int):
            db = concurrent_factory()
            try:
                user = db.get(User, user_id)
                request = ParkingReservationCreate(
                    parking_zone_id=2,
                    vehicle_type="CAR",
                    requested_arrival_at=self.now + timedelta(minutes=30),
                )
                simultaneous_start.wait(timeout=5)
                with patch.object(
                    websocket_manager,
                    "publish_notification",
                ):
                    create_reservation(db, user, request)
                result = "created"
            except HTTPException as exc:
                result = f"rejected:{exc.status_code}"
            except Exception as exc:  # captured to report thread failures
                result = f"error:{type(exc).__name__}:{exc}"
            finally:
                db.close()
            with outcomes_lock:
                outcomes.append(result)

        threads = [
            threading.Thread(target=attempt, args=(1,)),
            threading.Thread(target=attempt, args=(2,)),
        ]

        try:
            with (
                patch.object(Query, "with_for_update", serialized_with_for_update),
                patch.object(Session, "commit", commit_and_release),
                patch.object(Session, "rollback", rollback_and_release),
                patch.object(Session, "close", close_and_release),
            ):
                for thread in threads:
                    thread.start()
                for thread in threads:
                    thread.join(timeout=10)

            self.assertTrue(all(not thread.is_alive() for thread in threads))
            self.assertEqual(sorted(outcomes), ["created", "rejected:400"])
            self.assertEqual(len(lock_calls), 2)

            verify_session = concurrent_factory()
            try:
                self.assertEqual(
                    verify_session.query(ParkingReservation)
                    .filter(ParkingReservation.parking_zone_id == 2)
                    .count(),
                    1,
                )
            finally:
                verify_session.close()
        finally:
            concurrent_engine.dispose()
            os.unlink(database_path)


if __name__ == "__main__":
    unittest.main()
