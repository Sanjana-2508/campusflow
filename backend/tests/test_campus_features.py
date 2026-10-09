import unittest
from datetime import date, time

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.building import Building
from app.models.club import Club
from app.models.event import Event
from app.models.event_bookmark import EventBookmark
from app.models.lost_found import LostFound
from app.models.user import User
from app.schemas.club import ClubCreate, ClubUpdate
from app.schemas.event import EventCreate, EventUpdate
from app.schemas.lost_found import LostFoundCreate, LostFoundUpdate
from app.services.clubs import (
    create_club,
    get_club,
    list_clubs,
    update_club,
    update_club_verification,
)
from app.services.events import (
    bookmark_event,
    cancel_event,
    create_event,
    list_bookmarked_events,
    list_events,
    remove_event_bookmark,
    get_event,
    update_event,
    update_event_status,
)
from app.services.lost_found import (
    create_item,
    get_item,
    list_items,
    update_item,
    update_item_status,
)


class CampusFeatureTests(unittest.TestCase):
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
                Building.__table__,
                Club.__table__,
                Event.__table__,
                EventBookmark.__table__,
                LostFound.__table__,
            ],
        )
        self.session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            expire_on_commit=False,
        )
        self.db = self.session_factory()
        self.student = User(
            id=1,
            name="Student One",
            email="student@example.test",
            password_hash="test-only",
            role="STUDENT",
        )
        self.other_student = User(
            id=2,
            name="Student Two",
            email="other@example.test",
            password_hash="test-only",
            role="STUDENT",
        )
        self.faculty = User(
            id=3,
            name="Faculty One",
            email="faculty@example.test",
            password_hash="test-only",
            role="FACULTY_STAFF",
        )
        self.admin = User(
            id=4,
            name="Admin One",
            email="admin@example.test",
            password_hash="test-only",
            role="ADMIN",
        )
        self.db.add_all(
            [self.student, self.other_student, self.faculty, self.admin]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_lost_found_create_filter_edit_and_status_permissions(self):
        report = create_item(
            self.db,
            self.student,
            LostFoundCreate(
                type="LOST",
                item_name="Blue notebook",
                description="Found near library",
                location="Library",
                item_date=date(2030, 1, 2),
            ),
        )
        self.assertEqual(report["user_id"], self.student.id)
        self.assertEqual(report["status"], "OPEN")
        self.assertEqual(
            len(list_items(self.db, item_type="LOST", search="notebook")),
            1,
        )
        self.assertEqual(get_item(self.db, report["id"])["item_name"], "Blue notebook")
        self.assertEqual(list_items(self.db, item_type="FOUND"), [])

        with self.assertRaises(HTTPException) as unauthorized:
            update_item(
                self.db,
                report["id"],
                self.other_student,
                LostFoundUpdate(item_name="Changed"),
            )
        self.assertEqual(unauthorized.exception.status_code, 403)

        edited = update_item(
            self.db,
            report["id"],
            self.student,
            LostFoundUpdate(location="Student center"),
        )
        self.assertEqual(edited["location"], "Student center")
        resolved = update_item_status(
            self.db,
            report["id"],
            self.student,
            "RESOLVED",
        )
        self.assertEqual(resolved["status"], "RESOLVED")
        with self.assertRaises(HTTPException) as transition_error:
            update_item_status(
                self.db,
                report["id"],
                self.student,
                "OPEN",
            )
        self.assertEqual(transition_error.exception.status_code, 400)
        removed = update_item_status(
            self.db,
            report["id"],
            self.admin,
            "REMOVED",
        )
        self.assertEqual(removed["status"], "REMOVED")
        self.assertEqual(list_items(self.db), [])
        self.assertEqual(len(list_items(self.db, include_removed=True)), 1)

    def test_lost_found_rejects_blank_required_name(self):
        with self.assertRaises(ValidationError):
            LostFoundCreate(type="FOUND", item_name="   ")
        with self.assertRaises(ValidationError):
            LostFoundUpdate(item_name=None)

    def test_club_submitted_pending_and_admin_controls_approval(self):
        club = create_club(
            self.db,
            self.student,
            ClubCreate(name=" Robotics "),
        )
        self.assertEqual(club["name"], "Robotics")
        self.assertEqual(club["verification_status"], "PENDING")
        self.assertEqual(get_club(self.db, club["id"], self.student)["name"], "Robotics")
        self.assertEqual(list_clubs(self.db), [])

        with self.assertRaises(HTTPException) as denied:
            update_club(
                self.db,
                club["id"],
                self.other_student,
                ClubUpdate(name="Impersonated club"),
            )
        self.assertEqual(denied.exception.status_code, 403)

        renamed = update_club(
            self.db,
            club["id"],
            self.student,
            ClubUpdate(name="Campus Robotics"),
        )
        self.assertEqual(renamed["name"], "Campus Robotics")
        approved = update_club_verification(
            self.db,
            club["id"],
            "APPROVED",
        )
        self.assertEqual(approved["verification_status"], "APPROVED")
        self.assertEqual(len(list_clubs(self.db, search="Robotics")), 1)

    def test_events_validate_dates_enforce_organizer_access_and_cancel(self):
        club = create_club(
            self.db,
            self.student,
            ClubCreate(name="Arts"),
        )
        with self.assertRaises(HTTPException) as unapproved:
            create_event(
                self.db,
                self.student,
                self.event_request(club_id=club["id"]),
            )
        self.assertEqual(unapproved.exception.status_code, 403)

        update_club_verification(self.db, club["id"], "APPROVED")
        event_data = self.event_request(club_id=club["id"])
        event = create_event(self.db, self.student, event_data)
        self.assertEqual(event["status"], "DRAFT")
        with self.assertRaises(HTTPException) as hidden:
            get_event(self.db, event["id"], self.other_student)
        self.assertEqual(hidden.exception.status_code, 404)

        with self.assertRaises(HTTPException) as bad_date:
            create_event(
                self.db,
                self.faculty,
                self.event_request(start_time=time(14), end_time=time(13)),
            )
        self.assertEqual(bad_date.exception.status_code, 422)

        with self.assertRaises(HTTPException) as forbidden_update:
            update_event(
                self.db,
                event["id"],
                self.other_student,
                EventUpdate(**event_data.model_dump()),
            )
        self.assertEqual(forbidden_update.exception.status_code, 403)

        event_data = EventUpdate(
            **{
                **event_data.model_dump(),
                "title": "Updated showcase",
            }
        )
        edited = update_event(self.db, event["id"], self.student, event_data)
        self.assertEqual(edited["title"], "Updated showcase")
        published = update_event_status(
            self.db,
            event["id"],
            self.student,
            "PUBLISHED",
        )
        self.assertEqual(published["status"], "PUBLISHED")
        self.assertEqual(get_event(self.db, event["id"], self.other_student)["status"], "PUBLISHED")
        self.assertEqual(len(list_events(self.db, self.other_student)), 1)
        cancelled = cancel_event(self.db, event["id"], self.student)
        self.assertEqual(cancelled["status"], "CANCELLED")
        with self.assertRaises(HTTPException):
            update_event_status(self.db, event["id"], self.student, "PUBLISHED")

    def test_standalone_events_are_staff_or_admin_and_bookmarks_are_per_user(self):
        with self.assertRaises(HTTPException) as student_denied:
            create_event(self.db, self.student, self.event_request())
        self.assertEqual(student_denied.exception.status_code, 403)

        event = create_event(self.db, self.faculty, self.event_request())
        published = update_event_status(
            self.db,
            event["id"],
            self.faculty,
            "PUBLISHED",
        )
        self.assertEqual(published["status"], "PUBLISHED")

        first = bookmark_event(self.db, event["id"], self.student)
        duplicate = bookmark_event(self.db, event["id"], self.student)
        self.assertEqual(first.id, duplicate.id)
        self.assertEqual(len(list_bookmarked_events(self.db, self.student.id)), 1)
        self.assertEqual(list_bookmarked_events(self.db, self.other_student.id), [])

        with self.assertRaises(HTTPException) as not_owned:
            remove_event_bookmark(self.db, event["id"], self.other_student.id)
        self.assertEqual(not_owned.exception.status_code, 404)
        remove_event_bookmark(self.db, event["id"], self.student.id)
        self.assertEqual(list_bookmarked_events(self.db, self.student.id), [])

    @staticmethod
    def event_request(
        *,
        club_id: int | None = None,
        start_time: time = time(10),
        end_time: time = time(11),
    ) -> EventCreate:
        return EventCreate(
            title="Campus showcase",
            description="Project demonstrations",
            club_id=club_id,
            venue="Main hall",
            event_date=date(2030, 5, 20),
            start_time=start_time,
            end_time=end_time,
        )


if __name__ == "__main__":
    unittest.main()
