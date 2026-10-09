import asyncio
import json
import unittest
from datetime import date, time
from urllib.parse import urlsplit

from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import Date, Time

from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.building import Building
from app.models.club import Club
from app.models.event import Event
from app.models.event_bookmark import EventBookmark
from app.models.lost_found import LostFound
from app.models.user import User


class CampusApiTests(unittest.TestCase):
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
        with self.session_factory() as db:
            self.student = User(
                id=1,
                name="Student One",
                email="api-student@example.test",
                password_hash="test-only",
                role="STUDENT",
            )
            self.other_student = User(
                id=2,
                name="Student Two",
                email="api-other@example.test",
                password_hash="test-only",
                role="STUDENT",
            )
            self.staff = User(
                id=3,
                name="Staff One",
                email="api-staff@example.test",
                password_hash="test-only",
                role="FACULTY_STAFF",
            )
            self.admin = User(
                id=4,
                name="Admin One",
                email="api-admin@example.test",
                password_hash="test-only",
                role="ADMIN",
            )
            db.add_all(
                [self.student, self.other_student, self.staff, self.admin]
            )
            db.commit()

        self._old_overrides = app.dependency_overrides.copy()

        def override_get_db():
            db = self.session_factory()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db

    def tearDown(self):
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self._old_overrides)
        self.engine.dispose()

    def test_feature_models_match_existing_schema_columns(self):
        expected_columns = {
            "users": {
                "id", "name", "email", "phone", "password_hash", "role",
                "department", "created_at",
            },
            "buildings": {"id", "name", "type", "lat", "lng", "description"},
            "clubs": {
                "id", "name", "description", "owner_user_id",
                "verification_status",
            },
            "events": {
                "id", "title", "description", "organizer_user_id", "club_id",
                "venue", "venue_building_id", "event_date", "start_time",
                "end_time", "poster", "registration_url", "qr_code",
                "expected_attendance", "status",
            },
            "event_bookmarks": {"id", "user_id", "event_id", "created_at"},
            "lost_found": {
                "id", "user_id", "type", "item_name", "description",
                "location", "item_date", "image", "contact", "status",
                "created_at",
            },
        }
        for table_name, expected in expected_columns.items():
            self.assertEqual(
                set(Base.metadata.tables[table_name].columns.keys()),
                expected,
            )

        self.assertIsInstance(Event.__table__.c.event_date.type, Date)
        self.assertIsInstance(Event.__table__.c.start_time.type, Time)
        self.assertIsInstance(Event.__table__.c.end_time.type, Time)
        self.assertIsInstance(LostFound.__table__.c.item_date.type, Date)
        self.assertFalse(Building.__table__.c.type.nullable)

        club_foreign_key = next(iter(Club.__table__.foreign_keys))
        self.assertEqual(club_foreign_key.ondelete, "RESTRICT")
        self.assertEqual(club_foreign_key.onupdate, "CASCADE")
        event_foreign_keys = {
            foreign_key.parent.name: foreign_key
            for foreign_key in Event.__table__.foreign_keys
        }
        self.assertEqual(event_foreign_keys["organizer_user_id"].ondelete, "RESTRICT")
        self.assertEqual(event_foreign_keys["club_id"].ondelete, "SET NULL")
        self.assertEqual(event_foreign_keys["venue_building_id"].ondelete, "SET NULL")
        self.assertIn(
            "uq_user_event_bookmark",
            {constraint.name for constraint in EventBookmark.__table__.constraints},
        )
        self.assertTrue(
            all(
                foreign_key.ondelete == "CASCADE"
                and foreign_key.onupdate == "CASCADE"
                for foreign_key in EventBookmark.__table__.foreign_keys
            )
        )
        lost_found_foreign_key = next(iter(LostFound.__table__.foreign_keys))
        self.assertEqual(lost_found_foreign_key.ondelete, "CASCADE")
        self.assertEqual(lost_found_foreign_key.onupdate, "CASCADE")

    def request(self, method: str, path: str, user: User | None = None, body=None):
        return asyncio.run(
            self._asgi_request(
                method,
                path,
                token=create_access_token(user.id) if user else None,
                body=body,
            )
        )

    async def _asgi_request(
        self,
        method: str,
        path: str,
        *,
        token: str | None,
        body,
    ):
        parsed = urlsplit(path)
        request_body = b"" if body is None else json.dumps(body).encode()
        headers = []
        if body is not None:
            headers.append((b"content-type", b"application/json"))
        if token:
            headers.append((b"authorization", f"Bearer {token}".encode()))
        sent_request = False
        messages = []

        async def receive():
            nonlocal sent_request
            if not sent_request:
                sent_request = True
                return {
                    "type": "http.request",
                    "body": request_body,
                    "more_body": False,
                }
            return {"type": "http.disconnect"}

        async def send(message):
            messages.append(message)

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": parsed.path,
            "raw_path": parsed.path.encode(),
            "query_string": parsed.query.encode(),
            "root_path": "",
            "headers": headers,
            "client": ("testclient", 12345),
            "server": ("testserver", 80),
            "state": {},
        }
        await app(scope, receive, send)
        start = next(message for message in messages if message["type"] == "http.response.start")
        response_body = b"".join(
            message.get("body", b"")
            for message in messages
            if message["type"] == "http.response.body"
        )
        return start["status"], json.loads(response_body) if response_body else None

    def test_lost_found_routes_authenticate_and_enforce_ownership(self):
        status, _ = self.request("GET", "/lost-found")
        self.assertEqual(status, 401)

        status, report = self.request(
            "POST",
            "/lost-found",
            self.student,
            {
                "type": "LOST",
                "item_name": "Blue notebook",
                "location": "Library",
                "item_date": "2026-10-09",
            },
        )
        self.assertEqual(status, 201)
        report_id = report["id"]

        status, _ = self.request(
            "PUT",
            f"/lost-found/{report_id}",
            self.other_student,
            {"item_name": "Not their report"},
        )
        self.assertEqual(status, 403)

        status, edited = self.request(
            "PUT",
            f"/lost-found/{report_id}",
            self.student,
            {"location": "Student center"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(edited["location"], "Student center")

        status, resolved = self.request(
            "PATCH",
            f"/lost-found/{report_id}/status",
            self.student,
            {"status": "RESOLVED"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(resolved["status"], "RESOLVED")

        status, _ = self.request(
            "PATCH",
            f"/lost-found/{report_id}/status",
            self.student,
            {"status": "OPEN"},
        )
        self.assertEqual(status, 400)

        status, _ = self.request(
            "PATCH",
            f"/lost-found/{report_id}/status",
            self.other_student,
            {"status": "RESOLVED"},
        )
        self.assertEqual(status, 403)
        status, _ = self.request(
            "PATCH",
            f"/lost-found/{report_id}/status",
            self.student,
            {"status": "REMOVED"},
        )
        self.assertEqual(status, 403)

        status, _ = self.request(
            "PATCH",
            f"/lost-found/{report_id}/status",
            self.admin,
            {"status": "REMOVED"},
        )
        self.assertEqual(status, 200)
        status, reports = self.request("GET", "/lost-found", self.other_student)
        self.assertEqual(status, 200)
        self.assertEqual(reports, [])
        status, _ = self.request(
            "GET",
            f"/lost-found/{report_id}",
            self.other_student,
        )
        self.assertEqual(status, 404)

        status, _ = self.request(
            "POST",
            "/lost-found",
            self.student,
            {"type": "LOST", "item_name": "   "},
        )
        self.assertEqual(status, 422)
        status, _ = self.request(
            "POST",
            "/lost-found",
            self.student,
            {
                "type": "FOUND",
                "item_name": "Wallet",
                "user_id": self.other_student.id,
                "status": "RESOLVED",
            },
        )
        self.assertEqual(status, 422)
        status, _ = self.request(
            "PUT",
            f"/lost-found/{report_id}",
            self.admin,
            {"status": "OPEN", "user_id": self.other_student.id},
        )
        self.assertEqual(status, 422)

    def test_club_routes_approval_is_admin_only_and_pending_is_private(self):
        status, club = self.request(
            "POST",
            "/clubs",
            self.student,
            {"name": "Robotics"},
        )
        self.assertEqual(status, 201)
        club_id = club["id"]

        status, public_clubs = self.request("GET", "/clubs", self.other_student)
        self.assertEqual(status, 200)
        self.assertEqual(public_clubs, [])
        status, _ = self.request(
            "GET",
            f"/clubs/{club_id}",
            self.other_student,
        )
        self.assertEqual(status, 404)
        status, _ = self.request(
            "PUT",
            f"/clubs/{club_id}",
            self.other_student,
            {"name": "Unauthorized change"},
        )
        self.assertEqual(status, 403)

        status, _ = self.request(
            "PATCH",
            f"/clubs/{club_id}/verification",
            self.student,
            {"verification_status": "APPROVED"},
        )
        self.assertEqual(status, 403)

        status, _ = self.request(
            "PUT",
            f"/clubs/{club_id}",
            self.student,
            {"name": "Robotics renamed", "verification_status": "APPROVED"},
        )
        self.assertEqual(status, 422)
        status, owner_updated = self.request(
            "PUT",
            f"/clubs/{club_id}",
            self.student,
            {"name": "Robotics renamed"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(owner_updated["verification_status"], "PENDING")

        status, _ = self.request(
            "GET",
            "/clubs?verification_status=PENDING",
            self.other_student,
        )
        self.assertEqual(status, 403)

        status, approved = self.request(
            "PATCH",
            f"/clubs/{club_id}/verification",
            self.admin,
            {"verification_status": "APPROVED"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(approved["verification_status"], "APPROVED")
        status, public_clubs = self.request("GET", "/clubs", self.other_student)
        self.assertEqual(status, 200)
        self.assertEqual(len(public_clubs), 1)

        status, _ = self.request(
            "PATCH",
            f"/clubs/{club_id}/verification",
            self.admin,
            {"verification_status": "REJECTED"},
        )
        self.assertEqual(status, 200)
        status, public_clubs = self.request("GET", "/clubs", self.other_student)
        self.assertEqual(public_clubs, [])

    def test_event_routes_require_complete_updates_and_preserve_club_ownership(self):
        status, _ = self.request("GET", "/events")
        self.assertEqual(status, 401)

        status, _ = self.request(
            "POST",
            "/events",
            self.student,
            self.event_payload(),
        )
        self.assertEqual(status, 403)
        status, _ = self.request(
            "POST",
            "/events",
            self.staff,
            {
                **self.event_payload(),
                "organizer_user_id": self.student.id,
                "status": "PUBLISHED",
            },
        )
        self.assertEqual(status, 422)

        status, own_club = self.request(
            "POST",
            "/clubs",
            self.student,
            {"name": "Student Club"},
        )
        self.assertEqual(status, 201)
        status, _ = self.request(
            "PATCH",
            f"/clubs/{own_club['id']}/verification",
            self.admin,
            {"verification_status": "APPROVED"},
        )
        self.assertEqual(status, 200)

        status, other_club = self.request(
            "POST",
            "/clubs",
            self.other_student,
            {"name": "Other Club"},
        )
        self.assertEqual(status, 201)
        status, _ = self.request(
            "PATCH",
            f"/clubs/{other_club['id']}/verification",
            self.admin,
            {"verification_status": "APPROVED"},
        )
        self.assertEqual(status, 200)

        event_payload = self.event_payload(club_id=own_club["id"])
        status, event = self.request(
            "POST",
            "/events",
            self.student,
            event_payload,
        )
        self.assertEqual(status, 201)
        event_id = event["id"]

        status, _ = self.request(
            "PUT",
            f"/events/{event_id}",
            self.other_student,
            event_payload,
        )
        self.assertEqual(status, 403)

        status, _ = self.request(
            "PUT",
            f"/events/{event_id}",
            self.student,
            {"title": "Incomplete replacement"},
        )
        self.assertEqual(status, 422)

        invalid_times = self.event_payload(
            club_id=own_club["id"],
            start_time="14:00:00",
            end_time="13:00:00",
        )
        status, _ = self.request(
            "POST",
            "/events",
            self.student,
            invalid_times,
        )
        self.assertEqual(status, 422)

        timezone_times = self.event_payload(
            club_id=own_club["id"],
            start_time="10:00:00+02:00",
        )
        status, _ = self.request(
            "POST",
            "/events",
            self.student,
            timezone_times,
        )
        self.assertEqual(status, 422)
        invalid_date = self.event_payload(club_id=own_club["id"])
        invalid_date["event_date"] = "not-a-date"
        status, _ = self.request(
            "POST",
            "/events",
            self.student,
            invalid_date,
        )
        self.assertEqual(status, 422)

        changed_club_payload = {
            **event_payload,
            "club_id": other_club["id"],
        }
        status, _ = self.request(
            "PUT",
            f"/events/{event_id}",
            self.student,
            changed_club_payload,
        )
        self.assertEqual(status, 403)

        status, _ = self.request(
            "PATCH",
            f"/clubs/{own_club['id']}/verification",
            self.admin,
            {"verification_status": "REJECTED"},
        )
        self.assertEqual(status, 200)
        status, _ = self.request(
            "PATCH",
            f"/events/{event_id}/status",
            self.student,
            {"status": "PUBLISHED"},
        )
        self.assertEqual(status, 403)
        status, _ = self.request(
            "PATCH",
            f"/clubs/{own_club['id']}/verification",
            self.admin,
            {"verification_status": "APPROVED"},
        )
        self.assertEqual(status, 200)

        status, edited = self.request(
            "PUT",
            f"/events/{event_id}",
            self.student,
            {**event_payload, "title": "Updated showcase"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(edited["title"], "Updated showcase")

    def test_bookmark_routes_are_idempotent_user_scoped_and_hidden_when_closed(self):
        status, event = self.request(
            "POST",
            "/events",
            self.staff,
            self.event_payload(),
        )
        self.assertEqual(status, 201)
        status, published = self.request(
            "PATCH",
            f"/events/{event['id']}/status",
            self.staff,
            {"status": "PUBLISHED"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(published["status"], "PUBLISHED")

        status, bookmark = self.request(
            "POST",
            f"/events/{event['id']}/bookmark",
            self.student,
        )
        self.assertEqual(status, 201)
        status, duplicate = self.request(
            "POST",
            f"/events/{event['id']}/bookmark",
            self.student,
        )
        self.assertEqual(status, 201)
        self.assertEqual(duplicate["id"], bookmark["id"])
        with self.session_factory() as db:
            self.assertEqual(db.query(EventBookmark).count(), 1)
            db.add(
                EventBookmark(
                    user_id=self.student.id,
                    event_id=event["id"],
                )
            )
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()
            self.assertEqual(db.query(EventBookmark).count(), 1)

        status, bookmarks = self.request(
            "GET",
            "/events/bookmarks/me",
            self.student,
        )
        self.assertEqual(status, 200)
        self.assertEqual([entry["id"] for entry in bookmarks], [event["id"]])

        status, _ = self.request(
            "DELETE",
            f"/events/{event['id']}/bookmark",
            self.other_student,
        )
        self.assertEqual(status, 404)

        status, cancelled = self.request(
            "PATCH",
            f"/events/{event['id']}/cancel",
            self.staff,
        )
        self.assertEqual(status, 200)
        self.assertEqual(cancelled["status"], "CANCELLED")

        status, bookmarks = self.request(
            "GET",
            "/events/bookmarks/me",
            self.student,
        )
        self.assertEqual(status, 200)
        self.assertEqual(bookmarks, [])
        with self.session_factory() as db:
            self.assertEqual(db.query(EventBookmark).count(), 1)

        status, _ = self.request(
            "PATCH",
            f"/events/{event['id']}/status",
            self.staff,
            {"status": "PUBLISHED"},
        )
        self.assertEqual(status, 400)
        status, _ = self.request(
            "POST",
            f"/events/{event['id']}/bookmark",
            self.student,
        )
        self.assertEqual(status, 404)

        status, _ = self.request(
            "DELETE",
            f"/events/{event['id']}/bookmark",
            self.student,
        )
        self.assertEqual(status, 204)
        with self.session_factory() as db:
            self.assertEqual(db.query(EventBookmark).count(), 0)

    def test_event_lifecycle_and_club_owner_change_authorization(self):
        status, club = self.request(
            "POST",
            "/clubs",
            self.student,
            {"name": "Transferred Club"},
        )
        self.assertEqual(status, 201)
        status, _ = self.request(
            "PATCH",
            f"/clubs/{club['id']}/verification",
            self.admin,
            {"verification_status": "APPROVED"},
        )
        self.assertEqual(status, 200)

        status, event = self.request(
            "POST",
            "/events",
            self.student,
            self.event_payload(club_id=club["id"]),
        )
        self.assertEqual(status, 201)

        with self.session_factory() as db:
            persisted_club = db.get(Club, club["id"])
            persisted_club.owner_user_id = self.other_student.id
            db.commit()

        update_payload = self.event_payload(club_id=club["id"])
        status, _ = self.request(
            "PUT",
            f"/events/{event['id']}",
            self.student,
            update_payload,
        )
        self.assertEqual(status, 403)

        status, event = self.request(
            "PUT",
            f"/events/{event['id']}",
            self.other_student,
            update_payload,
        )
        self.assertEqual(status, 200)
        self.assertEqual(event["status"], "DRAFT")

        status, published = self.request(
            "PATCH",
            f"/events/{event['id']}/status",
            self.other_student,
            {"status": "PUBLISHED"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(published["status"], "PUBLISHED")

        status, edited_published = self.request(
            "PUT",
            f"/events/{event['id']}",
            self.other_student,
            {**update_payload, "title": "Published event edit"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(edited_published["status"], "PUBLISHED")
        self.assertEqual(edited_published["title"], "Published event edit")

        status, repeated_publish = self.request(
            "PATCH",
            f"/events/{event['id']}/status",
            self.other_student,
            {"status": "PUBLISHED"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(repeated_publish["status"], "PUBLISHED")

        status, _ = self.request(
            "PATCH",
            f"/events/{event['id']}/status",
            self.other_student,
            {"status": "DRAFT"},
        )
        self.assertEqual(status, 400)

        status, cancelled = self.request(
            "PATCH",
            f"/events/{event['id']}/cancel",
            self.other_student,
        )
        self.assertEqual(status, 200)
        self.assertEqual(cancelled["status"], "CANCELLED")

        status, _ = self.request(
            "PUT",
            f"/events/{event['id']}",
            self.admin,
            update_payload,
        )
        self.assertEqual(status, 400)
        status, _ = self.request(
            "PATCH",
            f"/events/{event['id']}/status",
            self.admin,
            {"status": "PUBLISHED"},
        )
        self.assertEqual(status, 400)

        status, pending_club = self.request(
            "POST",
            "/clubs",
            self.student,
            {"name": "Pending Event Club"},
        )
        self.assertEqual(status, 201)
        status, pending_event = self.request(
            "POST",
            "/events",
            self.admin,
            self.event_payload(club_id=pending_club["id"]),
        )
        self.assertEqual(status, 201)
        status, _ = self.request(
            "PATCH",
            f"/events/{pending_event['id']}/status",
            self.admin,
            {"status": "PUBLISHED"},
        )
        self.assertEqual(status, 403)

        with self.session_factory() as db:
            removed = Event(
                title="Removed event",
                organizer_user_id=self.staff.id,
                event_date=date(2026, 10, 21),
                start_time=time(10),
                end_time=time(11),
                status="REMOVED",
            )
            db.add(removed)
            db.commit()
            removed_id = removed.id

        status, _ = self.request(
            "PUT",
            f"/events/{removed_id}",
            self.admin,
            self.event_payload(),
        )
        self.assertEqual(status, 400)
        status, _ = self.request(
            "PATCH",
            f"/events/{removed_id}/status",
            self.admin,
            {"status": "PUBLISHED"},
        )
        self.assertEqual(status, 400)

    @staticmethod
    def event_payload(
        *,
        club_id: int | None = None,
        start_time: str = "10:00:00",
        end_time: str = "11:00:00",
    ) -> dict:
        return {
            "title": "Campus showcase",
            "description": "Project demonstrations",
            "club_id": club_id,
            "venue": "Main hall",
            "event_date": date(2026, 10, 20).isoformat(),
            "start_time": start_time,
            "end_time": end_time,
            "expected_attendance": 20,
        }


if __name__ == "__main__":
    unittest.main()
