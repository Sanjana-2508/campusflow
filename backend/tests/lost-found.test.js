import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import request from "supertest";
import sharp from "sharp";
import { createApp } from "../server.js";

async function csrf(agent) {
  const response = await agent.get("/api/auth/csrf").expect(200);
  return response.body.csrfToken;
}

async function register(agent, email, token, requestedRole = "student") {
  const response = await agent.post("/api/auth/register")
    .set("x-csrf-token", token)
    .send({ name: email.split("@")[0], email, password: "CampusFlow!2026Strong", requestedRole })
    .expect(201);
  return response.body.user;
}

test("Lost & Found authentication, ownership, claims, review, uploads, and persistence", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "campusflow-test-"));
  const databasePath = path.join(dataDirectory, "test.sqlite");
  const uploadDirectory = path.join(dataDirectory, "uploads");
  const options = {
    databasePath,
    uploadDirectory,
    adminEmail: "staff@example.edu",
    adminPassword: "CampusAdmin!2026Long",
  };
  let app = await createApp(options);

  try {
    const owner = request.agent(app);
    const ownerCsrf = await csrf(owner);
    await owner.post("/api/auth/register")
      .set("x-csrf-token", ownerCsrf)
      .send({ name: "Attempted Admin", email: "intruder@example.edu", password: "CampusFlow!2026Strong", role: "admin" })
      .expect(403);
    const ownerUser = await register(owner, "owner@example.edu", ownerCsrf);
    assert.equal(ownerUser.role, "student");

    const finder = request.agent(app);
    const finderCsrf = await csrf(finder);
    await register(finder, "finder@example.edu", finderCsrf);

    const secondFinder = request.agent(app);
    const secondFinderCsrf = await csrf(secondFinder);
    await register(secondFinder, "second-finder@example.edu", secondFinderCsrf);

    const staff = request.agent(app);
    const staffCsrf = await csrf(staff);
    const login = await staff.post("/api/auth/login")
      .set("x-csrf-token", staffCsrf)
      .send({ email: options.adminEmail, password: options.adminPassword })
      .expect(200);
    assert.equal(login.body.user.role, "admin");

    const faculty = request.agent(app);
    const facultyCsrf = await csrf(faculty);
    const facultyRegistration = await faculty.post("/api/auth/register")
      .set("x-csrf-token", facultyCsrf)
      .send({ name: "Faculty Requester", email: "faculty@example.edu", password: "CampusFlow!2026Strong", requestedRole: "faculty" })
      .expect(201);
    assert.equal(facultyRegistration.body.user.role, "student", "requested role must not be active before approval");
    assert.equal(facultyRegistration.body.roleRequest.status, "pending");
    assert.equal((await faculty.get("/api/auth/me").expect(200)).body.user.role, "student");

    const clubOrganiser = request.agent(app);
    const clubCsrf = await csrf(clubOrganiser);
    const clubRegistration = await clubOrganiser.post("/api/auth/register")
      .set("x-csrf-token", clubCsrf)
      .send({ name: "Club Requester", email: "club@example.edu", password: "CampusFlow!2026Strong", requestedRole: "club_organiser" })
      .expect(201);
    assert.equal(clubRegistration.body.user.role, "student");
    assert.equal(clubRegistration.body.roleRequest.requestedRole, "club_organiser");
    await clubOrganiser.post("/api/auth/register")
      .set("x-csrf-token", clubCsrf)
      .send({ name: "Admin Requester", email: "admin-escalation@example.edu", password: "CampusFlow!2026Strong", requestedRole: "admin" })
      .expect(403);

    await staff.get("/api/admin/role-requests").expect(200).then((response) => {
      assert.equal(response.body.pendingCount, 2);
    });
    await owner.get("/api/admin/role-requests").expect(403);
    const roleRequests = await staff.get("/api/admin/role-requests").expect(200);
    const facultyRequest = roleRequests.body.requests.find((item) => item.requested_role === "faculty");
    const clubRequest = roleRequests.body.requests.find((item) => item.requested_role === "club_organiser");
    await staff.post(`/api/admin/role-requests/${facultyRequest.id}/review`)
      .set("x-csrf-token", staffCsrf)
      .send({ decision: "approved", notes: "Verified with campus HR." })
      .expect(200);
    await staff.post(`/api/admin/role-requests/${clubRequest.id}/review`)
      .set("x-csrf-token", staffCsrf)
      .send({ decision: "rejected", notes: "Club appointment was not verified." })
      .expect(200);
    assert.equal((await faculty.get("/api/auth/me").expect(200)).body.user.role, "faculty", "persisted approval is loaded into an existing session");
    assert.equal((await clubOrganiser.get("/api/auth/me").expect(200)).body.user.role, "student", "rejected access request leaves the account as Student");
    const facultyLogin = await faculty.post("/api/auth/login")
      .set("x-csrf-token", facultyCsrf)
      .send({ email: "faculty@example.edu", password: "CampusFlow!2026Strong" })
      .expect(200);
    assert.equal(facultyLogin.body.user.role, "faculty", "login returns the approved role from persistent server data");
    assert.equal((await staff.post(`/api/admin/role-requests/${facultyRequest.id}/review`)
      .set("x-csrf-token", staffCsrf)
      .send({ decision: "approved" })).status, 409, "review cannot be repeated after decision");

    await request(app).get("/api/lost-found").expect(401);
    await request(app).get("/api/admin/reviews").expect(401);
    await finder.get("/api/admin/reviews").expect(403);

    await owner.post("/api/lost-found")
      .set("x-csrf-token", ownerCsrf)
      .send({ kind: "lost", name: "Invalid date", category: "Other", description: "Impossible date test.", location: "Library", eventDate: "2026-02-31" })
      .expect(400);

    const png = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#73856a" } }).png().toBuffer();
    const created = await owner.post("/api/lost-found")
      .set("x-csrf-token", ownerCsrf)
      .field("kind", "lost")
      .field("name", "Green campus umbrella")
      .field("category", "Accessories")
      .field("description", "Foldable umbrella with a wooden handle.")
      .field("location", "North lecture hall")
      .field("eventDate", "2026-10-09")
      .attach("image", png, { filename: "umbrella.png", contentType: "image/png" })
      .expect(201);
    const reportId = created.body.report.id;
    assert.equal(created.body.report.status, "lost");
    assert.equal(created.body.report.canEdit, true);
    assert.equal("email" in created.body.report, false, "public listing must not expose owner contact details");

    await finder.get(created.body.report.imageUrl).expect(200).expect("Content-Type", /image\/webp/);
    await request(app).get(created.body.report.imageUrl).expect(401);

    const edited = await owner.patch(`/api/lost-found/${reportId}`)
      .set("x-csrf-token", ownerCsrf)
      .field("name", "Green umbrella, updated")
      .field("removeImage", "true")
      .expect(200);
    assert.equal(edited.body.report.name, "Green umbrella, updated");
    assert.equal(edited.body.report.imageUrl, null);

    await finder.patch(`/api/lost-found/${reportId}`)
      .set("x-csrf-token", finderCsrf)
      .send({ name: "Changed by another student" })
      .expect(403);
    await finder.patch(`/api/lost-found/${reportId}`)
      .set("x-csrf-token", finderCsrf)
      .send({ status: "closed" })
      .expect(403);
    await finder.post(`/api/lost-found/${reportId}/claims`)
      .set("x-csrf-token", finderCsrf)
      .send({ notes: "I found an umbrella matching the handle and location." })
      .expect(201);
    await secondFinder.post(`/api/lost-found/${reportId}/claims`)
      .set("x-csrf-token", secondFinderCsrf)
      .send({ notes: "I also found a matching umbrella." })
      .expect(201);
    await finder.post(`/api/lost-found/${reportId}/claims`)
      .set("x-csrf-token", finderCsrf)
      .send({ notes: "Duplicate claim." })
      .expect(409);
    const stillLost = await finder.get("/api/lost-found").expect(200);
    assert.equal(stillLost.body.reports.find((report) => report.id === reportId).status, "lost", "claim submission must not verify the report");

    const reviews = await staff.get("/api/admin/reviews").expect(200);
    assert.equal(reviews.body.pendingCount, 2);
    const claimId = reviews.body.claims[0].id;
    await finder.post(`/api/admin/claims/${claimId}/review`)
      .set("x-csrf-token", finderCsrf)
      .send({ decision: "approved", notes: "Campus staff checked the hand-off." })
      .expect(403);
    await staff.post(`/api/admin/claims/${claimId}/review`)
      .set("x-csrf-token", staffCsrf)
      .send({ decision: "approved", notes: "Campus staff checked the hand-off." })
      .expect(200);
    const verified = await owner.get("/api/lost-found").expect(200);
    assert.equal(verified.body.reports.find((report) => report.id === reportId).status, "verified_found");
    const ownerNotifications = (await owner.get("/api/notifications").expect(200)).body.notifications;
    assert.equal(ownerNotifications.length, 3);
    await finder.patch(`/api/notifications/${ownerNotifications[0].id}/read`)
      .set("x-csrf-token", finderCsrf)
      .expect(404);
    await owner.patch(`/api/notifications/${ownerNotifications[0].id}/read`)
      .set("x-csrf-token", ownerCsrf)
      .expect(204);
    assert.equal((await staff.get("/api/admin/reviews").expect(200)).body.pendingCount, 0, "competing pending claims must be rejected when one claim is approved");
    assert.equal((await secondFinder.get("/api/notifications").expect(200)).body.notifications.length, 1);

    const foundReport = await owner.post("/api/lost-found")
      .set("x-csrf-token", ownerCsrf)
      .field("kind", "found")
      .field("name", "Unmarked notebook")
      .field("category", "Books")
      .field("description", "A notebook left in a shared study room.")
      .field("location", "Learning commons")
      .field("eventDate", "2026-10-09")
      .expect(201);
    assert.equal(foundReport.body.report.status, "pending_verification");
    const queue = await staff.get("/api/admin/reviews").expect(200);
    assert.equal(queue.body.pendingCount, 1);
    await staff.post(`/api/admin/reports/${foundReport.body.report.id}/review`)
      .set("x-csrf-token", staffCsrf)
      .send({ decision: "rejected", notes: "Unable to verify custody." })
      .expect(200);

    const withdrawable = await owner.post("/api/lost-found")
      .set("x-csrf-token", ownerCsrf)
      .field("kind", "lost")
      .field("name", "Withdrawable report")
      .field("category", "Other")
      .field("description", "This report will be withdrawn by its owner.")
      .field("location", "Student commons")
      .field("eventDate", "2026-10-09")
      .expect(201);
    await finder.patch(`/api/lost-found/${withdrawable.body.report.id}`)
      .set("x-csrf-token", finderCsrf)
      .send({ status: "closed" })
      .expect(403);
    await owner.patch(`/api/lost-found/${withdrawable.body.report.id}`)
      .set("x-csrf-token", ownerCsrf)
      .send({ status: "closed" })
      .expect(200);
    assert.equal((await owner.get("/api/lost-found").expect(200)).body.reports.some((report) => report.id === withdrawable.body.report.id), false);

    await owner.patch(`/api/lost-found/${reportId}`)
      .set("x-csrf-token", ownerCsrf)
      .send({ name: "Changed after verification" })
      .expect(409);

    const invalid = await owner.post("/api/lost-found")
      .set("x-csrf-token", ownerCsrf)
      .field("kind", "lost")
      .field("name", "Bad upload")
      .field("category", "Accessories")
      .field("description", "Image bytes are intentionally invalid.")
      .field("location", "Library")
      .field("eventDate", "2026-10-09")
      .attach("image", Buffer.from("not an image"), { filename: "fake.png", contentType: "image/png" })
      .expect(400);
    assert.match(invalid.body.error, /valid JPEG, PNG, or WebP/i);

    const tooLarge = await owner.post("/api/lost-found")
      .set("x-csrf-token", ownerCsrf)
      .field("kind", "lost")
      .field("name", "Oversized image")
      .field("category", "Accessories")
      .field("description", "This upload exceeds the server limit.")
      .field("location", "Library")
      .field("eventDate", "2026-10-09")
      .attach("image", Buffer.alloc(5 * 1024 * 1024 + 1), { filename: "large.png", contentType: "image/png" })
      .expect(413);
    assert.match(tooLarge.body.error, /5 MB/i);

    app.locals.close();
    app = await createApp(options);
    const restartedOwner = request.agent(app);
    const restartedCsrf = await csrf(restartedOwner);
    await restartedOwner.post("/api/auth/login")
      .set("x-csrf-token", restartedCsrf)
      .send({ email: "owner@example.edu", password: "CampusFlow!2026Strong" })
      .expect(200);
    const afterRestart = await restartedOwner.get("/api/lost-found").expect(200);
    const persisted = afterRestart.body.reports.find((report) => report.id === reportId);
    assert.equal(persisted.name, "Green umbrella, updated", "report changes persist after server restart");
    assert.equal(persisted.imageUrl, null, "removed images remain removed after server restart");
    await restartedOwner.post("/api/auth/logout").set("x-csrf-token", restartedCsrf).expect(204);
    await restartedOwner.get("/api/auth/me").expect(401);
  } finally {
    app.locals.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});

test("faculty directory, availability, and meeting requests enforce role and owner scope", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "campusflow-faculty-test-"));
  const options = {
    databasePath: path.join(dataDirectory, "faculty.sqlite"),
    uploadDirectory: path.join(dataDirectory, "uploads"),
    adminEmail: "faculty-admin@example.edu",
    adminPassword: "CampusAdmin!Faculty2026",
  };
  let app = await createApp(options);

  try {
    const admin = request.agent(app);
    const adminCsrf = await csrf(admin);
    await admin.post("/api/auth/login").set("x-csrf-token", adminCsrf)
      .send({ email: options.adminEmail, password: options.adminPassword }).expect(200);

    const faculty = request.agent(app);
    const facultyCsrf = await csrf(faculty);
    const facultyRegistration = await faculty.post("/api/auth/register")
      .set("x-csrf-token", facultyCsrf)
      .send({ name: "Avery Faculty", email: "avery-faculty@example.edu", password: "CampusFlow!2026Strong", requestedRole: "faculty" })
      .expect(201);
    const roleRequest = (await admin.get("/api/admin/role-requests").expect(200)).body.requests[0];
    await admin.post(`/api/admin/role-requests/${roleRequest.id}/review`)
      .set("x-csrf-token", adminCsrf).send({ decision: "approved" }).expect(200);

    const facultyId = facultyRegistration.body.user.id;
    await faculty.get("/api/admin/faculty").expect(403);
    await admin.put(`/api/admin/faculty/${facultyId}`)
      .set("x-csrf-token", adminCsrf)
      .send({ department: "Computer Science", subject: "Systems", cabinRoom: "B-214", building: "North Academic Block", floor: "2" })
      .expect(200);

    const student = request.agent(app);
    const studentCsrf = await csrf(student);
    const studentUser = await register(student, "meeting-student@example.edu", studentCsrf);
    const otherStudent = request.agent(app);
    const otherStudentCsrf = await csrf(otherStudent);
    await register(otherStudent, "other-meeting-student@example.edu", otherStudentCsrf);

    const directory = await student.get("/api/faculty").expect(200);
    assert.equal(directory.body.faculty.length, 1);
    assert.equal(directory.body.faculty[0].name, "Avery Faculty");
    assert.equal(directory.body.faculty[0].availabilityLabel, "Not in Cabin");
    assert.equal("email" in directory.body.faculty[0], false, "directory does not expose faculty email");
    await request(app).get("/api/faculty").expect(401);
    await otherStudent.get("/api/admin/faculty").expect(403);

    const inCabin = await faculty.patch("/api/faculty/me/availability")
      .set("x-csrf-token", facultyCsrf).send({ status: "in_cabin" }).expect(200);
    assert.equal(inCabin.body.availability.locationStatus, "in_cabin");
    const busy = await faculty.patch("/api/faculty/me/availability")
      .set("x-csrf-token", facultyCsrf).send({ status: "busy" }).expect(200);
    assert.equal(busy.body.availability.locationStatus, "in_cabin", "Busy must not overwrite physical location");
    assert.equal(busy.body.availability.meetingStatus, "busy");
    await student.patch("/api/faculty/me/availability")
      .set("x-csrf-token", studentCsrf).send({ status: "busy" }).expect(403);

    const preferredAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const created = await student.post("/api/meetings")
      .set("x-csrf-token", studentCsrf)
      .send({ facultyId, purpose: "Project advising", message: "I would like feedback on my project plan.", preferredAt })
      .expect(201);
    const meetingId = created.body.request.id;
    assert.equal(created.body.request.studentId, studentUser.id);
    assert.equal(created.body.request.status, "pending");
    assert.equal((await student.get("/api/meetings/mine").expect(200)).body.requests.length, 1);
    assert.equal((await otherStudent.get("/api/meetings/mine").expect(200)).body.requests.length, 0);
    await otherStudent.post(`/api/meetings/${meetingId}/cancel`)
      .set("x-csrf-token", otherStudentCsrf).expect(404);
    await otherStudent.patch(`/api/faculty/meetings/${meetingId}`)
      .set("x-csrf-token", otherStudentCsrf).send({ decision: "accepted" }).expect(403);

    const facultyQueue = await faculty.get("/api/faculty/meetings?status=pending").expect(200);
    assert.equal(facultyQueue.body.requests[0].studentName, "meeting-student");
    const suggestedAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    await faculty.patch(`/api/faculty/meetings/${meetingId}`)
      .set("x-csrf-token", facultyCsrf)
      .send({ decision: "accepted", response: "That time works.", suggestedAt })
      .expect(200);
    const accepted = (await student.get("/api/meetings/mine").expect(200)).body.requests[0];
    assert.equal(accepted.status, "accepted");
    assert.equal(accepted.facultyResponse, "That time works.");
    assert.equal(accepted.suggestedAt, suggestedAt);
    await faculty.patch(`/api/faculty/meetings/${meetingId}`)
      .set("x-csrf-token", facultyCsrf).send({ decision: "completed" }).expect(200);

    const cancellable = await student.post("/api/meetings")
      .set("x-csrf-token", studentCsrf)
      .send({ facultyId, purpose: "Office hours", message: "A second pending request.", preferredAt })
      .expect(201);
    await student.post(`/api/meetings/${cancellable.body.request.id}/cancel`)
      .set("x-csrf-token", studentCsrf).expect(200);
    assert.equal((await student.get("/api/meetings/mine").expect(200)).body.requests.find((item) => item.id === cancellable.body.request.id).status, "cancelled");

    app.locals.close();
    app = await createApp(options);
    const returningFaculty = request.agent(app);
    const returningCsrf = await csrf(returningFaculty);
    await returningFaculty.post("/api/auth/login").set("x-csrf-token", returningCsrf)
      .send({ email: "avery-faculty@example.edu", password: "CampusFlow!2026Strong" }).expect(200);
    const savedProfile = await returningFaculty.get("/api/faculty/me").expect(200);
    assert.equal(savedProfile.body.profile.department, "Computer Science");
    assert.equal(savedProfile.body.profile.locationStatus, "in_cabin");
    assert.equal(savedProfile.body.profile.meetingStatus, "busy");
    assert.equal((await returningFaculty.get("/api/faculty/meetings?status=completed").expect(200)).body.requests[0].status, "completed");
  } finally {
    app.locals.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});

test("registration and login preserve server-authoritative Student, Faculty, Club Organiser, and Admin roles", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "campusflow-auth-test-"));
  const options = {
    databasePath: path.join(dataDirectory, "auth.sqlite"),
    uploadDirectory: path.join(dataDirectory, "uploads"),
    adminEmail: "secure-admin@example.edu",
    adminPassword: "CampusAdmin!Secure2026",
  };
  let app = await createApp(options);

  try {
    const student = request.agent(app);
    const studentCsrf = await csrf(student);
    const studentRegistration = await student.post("/api/auth/register")
      .set("x-csrf-token", studentCsrf)
      .send({ name: "Auth Student", email: "auth-student@example.edu", password: "CampusFlow!2026Strong" })
      .expect(201);
    assert.equal(studentRegistration.body.user.role, "student");

    const badPassword = await student.post("/api/auth/login")
      .set("x-csrf-token", studentCsrf)
      .send({ email: "auth-student@example.edu", password: "wrong-password" })
      .expect(401);
    assert.deepEqual(badPassword.body, { error: "Email or password is incorrect." });
    const studentLogin = await student.post("/api/auth/login")
      .set("x-csrf-token", studentCsrf)
      .send({ email: "auth-student@example.edu", password: "CampusFlow!2026Strong" })
      .expect(200);
    assert.equal(studentLogin.body.user.role, "student");
    await student.get("/api/admin/role-requests").expect(403);
    await student.get("/api/faculty/me").expect(403);
    await student.get("/api/faculty/meetings").expect(403);
    await student.post("/api/meetings").set("x-csrf-token", studentCsrf).send({}).expect(400);

    const faculty = request.agent(app);
    const facultyCsrf = await csrf(faculty);
    const facultyRegistration = await faculty.post("/api/auth/register")
      .set("x-csrf-token", facultyCsrf)
      .send({ name: "Auth Faculty", email: "auth-faculty@example.edu", password: "CampusFlow!2026Strong", requestedRole: "faculty" })
      .expect(201);
    assert.equal(facultyRegistration.body.user.role, "student");
    const pendingFacultyLogin = await faculty.post("/api/auth/login")
      .set("x-csrf-token", facultyCsrf)
      .send({ email: "auth-faculty@example.edu", password: "CampusFlow!2026Strong" })
      .expect(200);
    assert.equal(pendingFacultyLogin.body.user.role, "student", "Faculty request remains pending until Admin approval");

    const club = request.agent(app);
    const clubCsrf = await csrf(club);
    const clubRegistration = await club.post("/api/auth/register")
      .set("x-csrf-token", clubCsrf)
      .send({ name: "Auth Club Organiser", email: "auth-club@example.edu", password: "CampusFlow!2026Strong", requestedRole: "club_organiser" })
      .expect(201);
    assert.equal(clubRegistration.body.user.role, "student");

    const admin = request.agent(app);
    const adminCsrf = await csrf(admin);
    await admin.post("/api/auth/login").set("x-csrf-token", adminCsrf)
      .send({ email: options.adminEmail, password: options.adminPassword }).expect(200)
      .then((response) => assert.equal(response.body.user.role, "admin"));
    await student.post("/api/auth/register")
      .set("x-csrf-token", studentCsrf)
      .send({ name: "Public Admin", email: "public-admin@example.edu", password: "CampusFlow!2026Strong", role: "admin" })
      .expect(403);
    await student.post("/api/auth/register")
      .set("x-csrf-token", studentCsrf)
      .send({ name: "Requested Admin", email: "requested-admin@example.edu", password: "CampusFlow!2026Strong", requestedRole: "admin" })
      .expect(403);

    const requests = (await admin.get("/api/admin/role-requests").expect(200)).body.requests;
    const facultyRequest = requests.find((item) => item.requested_role === "faculty");
    const clubRequest = requests.find((item) => item.requested_role === "club_organiser");
    await admin.post(`/api/admin/role-requests/${facultyRequest.id}/review`)
      .set("x-csrf-token", adminCsrf).send({ decision: "approved" }).expect(200);
    await admin.post(`/api/admin/role-requests/${clubRequest.id}/review`)
      .set("x-csrf-token", adminCsrf).send({ decision: "approved" }).expect(200);

    const approvedFacultyLogin = await faculty.post("/api/auth/login")
      .set("x-csrf-token", facultyCsrf)
      .send({ email: "auth-faculty@example.edu", password: "CampusFlow!2026Strong" }).expect(200);
    assert.equal(approvedFacultyLogin.body.user.role, "faculty");
    const approvedClubLogin = await club.post("/api/auth/login")
      .set("x-csrf-token", clubCsrf)
      .send({ email: "auth-club@example.edu", password: "CampusFlow!2026Strong" }).expect(200);
    assert.equal(approvedClubLogin.body.user.role, "club_organiser");

    await admin.post("/api/auth/logout").set("x-csrf-token", adminCsrf).expect(204);
    await admin.get("/api/auth/me").expect(401);
    await admin.get("/api/admin/role-requests").expect(401);
  } finally {
    app.locals.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});