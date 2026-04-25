import express from "express";
import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
// import DatabaseConstructor from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import multer from "multer";
import fs from "fs";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import cors from "cors";

const JWT_SECRET = process.env.JWT_SECRET || 'fshn-secret-key';

console.log("Server.ts is starting...");

process.on('uncaughtException', (err) => {
  console.error(`UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`UNHANDLED REJECTION: ${reason}`);
});

// Firebase Admin Initialization
const getFirebaseAdmin = () => {
  if (admin.apps.length > 0) return admin.apps[0];
  
  // Prefer config file values if they exist, to avoid stale environment variables from UI
  let config: any = {};
  try {
    config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
  } catch (e) {
    console.error("No firebase-applet-config.json found, using env vars.");
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.replace(/^['"]|['"]$/g, '').trim() || config.projectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.replace(/^['"]|['"]$/g, '').trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^['"]|['"]$/g, '').trim();

  if (projectId && clientEmail && privateKey) {
    try {
      console.log("Initializing Firebase Admin for project:", projectId);
      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket: `${projectId}.firebasestorage.app`
      });
    } catch (e) {
      console.error("Failed to initialize Firebase Admin:", e);
      return null;
    }
  }
  console.log("Firebase Admin env vars missing, skipping Firestore initialization.");
  return null;
};

const firebaseApp = getFirebaseAdmin();
let firestore: any = null;
try {
  if (firebaseApp) {
    let config: any = {};
    try {
      config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
    } catch (e) {}
    
    const dbId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || config.firestoreDatabaseId;
    console.log("Using Firestore database ID:", dbId);
    firestore = getFirestore(firebaseApp, dbId);
    console.log("Firestore initialized successfully.");
  }
} catch (e) {
  console.error("Firestore initialization failed:", e);
}

const getIsNetlify = () => {
  // Only true if explicitly set and NOT in AI Studio or other environments
  return !!process.env.NETLIFY && !process.env.AI_STUDIO && !process.env.RENDER;
};
const getIsVercel = () => !!process.env.VERCEL;
const getIsRender = () => !!process.env.RENDER;
const getIsProduction = () => process.env.NODE_ENV === "production" || getIsVercel() || getIsRender() || getIsNetlify();

console.log("Environment Check:", {
  NODE_ENV: process.env.NODE_ENV,
  isProduction: getIsProduction(),
  isNetlify: getIsNetlify(),
  isVercel: getIsVercel(),
  isRender: getIsRender(),
  cwd: process.cwd()
});

const _dirname = process.cwd();

const getTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error("Kredencialet e email-it nuk janë vendosur. Ju lutem konfiguroni EMAIL_USER dhe EMAIL_PASS në Settings.");
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
};

let db: any;

const offensiveWords = [
  "fuck", "shit", "bitch", "asshole", "bastard", "dick", "pussy", "cunt", 
  "pidh", "kar", "bytari", "cope", "rob", "serb", "kurv", "pleh", "mut", "gomar", "qyq"
];

function filterProfanity(text: string): string {
  if (!text) return text;
  let filtered = text;
  offensiveWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '***');
  });
  return filtered;
}

export const initDb = async () => {
  if (db) return db;
  const isNetlifyEnv = getIsNetlify();
  const isVercelEnv = getIsVercel();
  const dbPath = (isVercelEnv || isNetlifyEnv) ? path.join("/tmp", "platform.db") : path.join(_dirname, "platform.db");
  
  try {
    // In serverless environments, better-sqlite3 might fail to load due to native bindings
    const { default: DatabaseConstructor } = await import("better-sqlite3");
    db = new DatabaseConstructor(dbPath);
    console.log("SQLite initialized successfully");
  } catch (e: any) {
    console.error(`Database initialization failed: ${e.message}`);
    db = {
      prepare: (sql: string) => ({
        run: () => ({ lastInsertRowid: 0, changes: 0 }),
        get: () => {
          if (sql.toLowerCase().includes("count")) return { count: 0 };
          return null;
        },
        all: () => []
      }),
      exec: () => {},
      transaction: (cb: any) => {
        return () => cb();
      }
    };
  }

  // Initialize Database
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    surname TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('STUDENT', 'TEACHER')) NOT NULL,
    phone TEXT,
    bio TEXT,
    program TEXT,
    year TEXT,
    group_name TEXT, -- A, B, C
    study_type TEXT, -- Bachelor, Master
    is_confirmed BOOLEAN DEFAULT 0,
    class_code TEXT,
    profile_photo TEXT,
    email_verified BOOLEAN DEFAULT 0,
    email_verified_shown BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    department TEXT,
    year TEXT,
    group_name TEXT,
    study_type TEXT,
    teacher_id INTEGER,
    admin_id INTEGER, -- Student admin
    pinned_note TEXT,
    note_updated_at DATETIME,
    opening_comment TEXT,
    opening_comment_at DATETIME,
    FOREIGN KEY(teacher_id) REFERENCES users(id),
    FOREIGN KEY(admin_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS class_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    user_id INTEGER,
    status TEXT CHECK(status IN ('PENDING', 'CONFIRMED', 'REFUSED')) DEFAULT 'PENDING',
    is_admin BOOLEAN DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    description TEXT,
    type TEXT CHECK(type IN ('INFO', 'POLL', 'DONATION')) DEFAULT 'INFO',
    link_url TEXT,
    file_url TEXT,
    poll_options TEXT, -- JSON array
    item_type TEXT, -- For donation
    status TEXT DEFAULT 'OPEN', -- For donation or general
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS activity_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER,
    user_id INTEGER,
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(activity_id) REFERENCES activities(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS activity_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER,
    user_id INTEGER,
    option_index INTEGER,
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(activity_id, user_id),
    FOREIGN KEY(activity_id) REFERENCES activities(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS teacher_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    class_id INTEGER,
    subject TEXT NOT NULL,
    day_of_week INTEGER, -- 1-5 (Mon-Fri)
    start_time TEXT NOT NULL, -- HH:MM
    end_time TEXT NOT NULL, -- HH:MM
    type TEXT CHECK(type IN ('LECTURE', 'SEMINAR')),
    FOREIGN KEY(teacher_id) REFERENCES users(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS library_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    file_path TEXT,
    external_link TEXT,
    uploader_id INTEGER,
    class_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(uploader_id) REFERENCES users(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER,
    semester INTEGER, -- 1, 2, 3
    credits INTEGER,
    teacher_id INTEGER,
    exam_date DATETIME,
    room TEXT,
    status TEXT DEFAULT 'SCHEDULED',
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS lecture_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER,
    status TEXT CHECK(status IN ('OPEN', 'SOON', 'NOT_COMING')),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(schedule_id) REFERENCES teacher_schedule(id)
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    class_id INTEGER,
    status TEXT CHECK(status IN ('PRESENT', 'ABSENT', 'OFFLINE')),
    verified_by_teacher BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    test_date DATETIME,
    duration INTEGER, -- in minutes
    total_points INTEGER,
    program TEXT,
    year TEXT,
    group_name TEXT,
    teacher_id INTEGER,
    status TEXT CHECK(status IN ('DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'IN_GRADING', 'PUBLISHED')) DEFAULT 'DRAFT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER,
    content TEXT NOT NULL,
    type TEXT CHECK(type IN ('MCQ', 'OPEN')),
    options TEXT, -- JSON string for MCQ
    correct_answer TEXT,
    points INTEGER,
    FOREIGN KEY(test_id) REFERENCES tests(id)
  );

  CREATE TABLE IF NOT EXISTS test_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER,
    user_id INTEGER,
    is_exam BOOLEAN DEFAULT 0,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    status TEXT CHECK(status IN ('STARTED', 'SUBMITTED', 'GRADED')) DEFAULT 'STARTED',
    total_score INTEGER DEFAULT 0,
    grade INTEGER, -- Final grade 4-10
    feedback TEXT,
    FOREIGN KEY(test_id) REFERENCES tests(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS test_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER,
    question_id INTEGER,
    answer_text TEXT,
    points_awarded INTEGER DEFAULT 0,
    is_correct BOOLEAN,
    FOREIGN KEY(attempt_id) REFERENCES test_attempts(id),
    FOREIGN KEY(question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER, -- NULL for class chat
    class_id INTEGER,
    chat_type TEXT CHECK(chat_type IN ('PRIVATE', 'CLASS', 'SCHOOL', 'TEACHER')) DEFAULT 'CLASS',
    content TEXT NOT NULL,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS live_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    student_id INTEGER,
    class_id INTEGER,
    content TEXT NOT NULL,
    answer TEXT,
    score INTEGER,
    status TEXT CHECK(status IN ('PENDING', 'CONFIRMED', 'ANSWERED', 'GRADED', 'EXPIRED')) DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id),
    FOREIGN KEY(student_id) REFERENCES users(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    deadline DATETIME,
    materials TEXT, -- Links or descriptions of materials
    max_points INTEGER DEFAULT 100,
    submission_type TEXT CHECK(submission_type IN ('FILE', 'TEXT', 'BOTH')) DEFAULT 'BOTH',
    status TEXT CHECK(status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')) DEFAULT 'DRAFT',
    teacher_id INTEGER,
    program TEXT,
    year TEXT,
    group_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER,
    student_id INTEGER,
    content TEXT,
    file_path TEXT,
    points INTEGER,
    grade INTEGER, -- Final grade 4-10
    feedback TEXT,
    status TEXT CHECK(status IN ('SUBMITTED', 'PENDING', 'GRADED')) DEFAULT 'SUBMITTED',
    is_late BOOLEAN DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    graded_at DATETIME,
    FOREIGN KEY(assignment_id) REFERENCES assignments(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    class_id INTEGER,
    subject TEXT,
    duration INTEGER, -- minutes
    status TEXT CHECK(status IN ('ACTIVE', 'COMPLETED')) DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS session_presence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    user_id INTEGER,
    is_verified BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES study_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    day_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    program TEXT NOT NULL,
    year TEXT NOT NULL,
    group_name TEXT,
    building TEXT NOT NULL,
    classroom TEXT NOT NULL,
    subject TEXT,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS performance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT CHECK(type IN ('TEST', 'ASSIGNMENT', 'ATTENDANCE', 'RATING')),
    score REAL,
    max_score REAL,
    comment TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS activity_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(activity_id) REFERENCES performance_logs(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(activity_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS activity_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER,
    user_id INTEGER,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(activity_id) REFERENCES performance_logs(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS activity_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(activity_id) REFERENCES performance_logs(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(activity_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS comment_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(comment_id) REFERENCES activity_comments(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(comment_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS personal_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    content TEXT,
    color TEXT,
    is_pinned BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration: Add missing columns if they don't exist
const userColumns = db.prepare("PRAGMA table_info(users)").all() as any[];
const userColumnNames = userColumns.map(c => c.name);
if (!userColumnNames.includes('surname')) db.prepare("ALTER TABLE users ADD COLUMN surname TEXT").run();
if (!userColumnNames.includes('phone')) db.prepare("ALTER TABLE users ADD COLUMN phone TEXT").run();
if (!userColumnNames.includes('bio')) db.prepare("ALTER TABLE users ADD COLUMN bio TEXT").run();
if (!userColumnNames.includes('group_name')) db.prepare("ALTER TABLE users ADD COLUMN group_name TEXT").run();
if (!userColumnNames.includes('study_type')) db.prepare("ALTER TABLE users ADD COLUMN study_type TEXT").run();
if (!userColumnNames.includes('program')) db.prepare("ALTER TABLE users ADD COLUMN program TEXT").run();
if (!userColumnNames.includes('year')) db.prepare("ALTER TABLE users ADD COLUMN year TEXT").run();
if (!userColumnNames.includes('is_confirmed')) db.prepare("ALTER TABLE users ADD COLUMN is_confirmed BOOLEAN DEFAULT 0").run();
if (!userColumnNames.includes('profile_photo')) db.prepare("ALTER TABLE users ADD COLUMN profile_photo TEXT").run();
if (!userColumnNames.includes('email_verified')) db.prepare("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0").run();
if (!userColumnNames.includes('email_verified_shown')) db.prepare("ALTER TABLE users ADD COLUMN email_verified_shown BOOLEAN DEFAULT 0").run();

const perfColumns = db.prepare("PRAGMA table_info(performance_logs)").all() as any[];
const perfColumnNames = perfColumns.map(c => c.name);
if (!perfColumnNames.includes('comment')) db.prepare("ALTER TABLE performance_logs ADD COLUMN comment TEXT").run();

const classColumns = db.prepare("PRAGMA table_info(classes)").all() as any[];
const classColumnNames = classColumns.map(c => c.name);
if (!classColumnNames.includes('department')) db.prepare("ALTER TABLE classes ADD COLUMN department TEXT").run();
if (!classColumnNames.includes('year')) db.prepare("ALTER TABLE classes ADD COLUMN year TEXT").run();
if (!classColumnNames.includes('group_name')) db.prepare("ALTER TABLE classes ADD COLUMN group_name TEXT").run();
if (!classColumnNames.includes('study_type')) db.prepare("ALTER TABLE classes ADD COLUMN study_type TEXT").run();
if (!classColumnNames.includes('admin_id')) db.prepare("ALTER TABLE classes ADD COLUMN admin_id INTEGER").run();
if (!classColumnNames.includes('pinned_note')) db.prepare("ALTER TABLE classes ADD COLUMN pinned_note TEXT").run();
if (!classColumnNames.includes('note_updated_at')) db.prepare("ALTER TABLE classes ADD COLUMN note_updated_at DATETIME").run();

const testColumns = db.prepare("PRAGMA table_info(tests)").all() as any[];
const testColumnNames = testColumns.map(c => c.name);
if (!testColumnNames.includes('group_name')) db.prepare("ALTER TABLE tests ADD COLUMN group_name TEXT").run();

const assignmentMigrateColumns = db.prepare("PRAGMA table_info(assignments)").all() as any[];
const assignmentMigrateColumnNames = assignmentMigrateColumns.map(c => c.name);
if (!assignmentMigrateColumnNames.includes('program')) db.prepare("ALTER TABLE assignments ADD COLUMN program TEXT").run();
if (!assignmentMigrateColumnNames.includes('year')) db.prepare("ALTER TABLE assignments ADD COLUMN year TEXT").run();
if (!assignmentMigrateColumnNames.includes('group_name')) db.prepare("ALTER TABLE assignments ADD COLUMN group_name TEXT").run();

const scheduleMigrateColumns = db.prepare("PRAGMA table_info(schedules)").all() as any[];
const scheduleMigrateColumnNames = scheduleMigrateColumns.map(c => c.name);
if (!scheduleMigrateColumnNames.includes('subject')) db.prepare("ALTER TABLE schedules ADD COLUMN subject TEXT").run();

const studySessionColumns = db.prepare("PRAGMA table_info(study_sessions)").all() as any[];
const studySessionColumnNames = studySessionColumns.map(c => c.name);
if (!studySessionColumnNames.includes('class_id')) db.prepare("ALTER TABLE study_sessions ADD COLUMN class_id INTEGER").run();
if (!studySessionColumnNames.includes('subject')) db.prepare("ALTER TABLE study_sessions ADD COLUMN subject TEXT").run();
if (!studySessionColumnNames.includes('duration')) db.prepare("ALTER TABLE study_sessions ADD COLUMN duration INTEGER").run();

const attendanceColumns = db.prepare("PRAGMA table_info(attendance)").all() as any[];
const attendanceColumnNames = attendanceColumns.map(c => c.name);
if (!attendanceColumnNames.includes('class_id')) db.prepare("ALTER TABLE attendance ADD COLUMN class_id INTEGER").run();
if (!attendanceColumnNames.includes('verified_by_teacher')) db.prepare("ALTER TABLE attendance ADD COLUMN verified_by_teacher BOOLEAN DEFAULT 0").run();

const libraryBookColumns = db.prepare("PRAGMA table_info(library_books)").all() as any[];
const libraryBookColumnNames = libraryBookColumns.map(c => c.name);
if (!libraryBookColumnNames.includes('external_link')) db.prepare("ALTER TABLE library_books ADD COLUMN external_link TEXT").run();
// Make file_path nullable for links
if (libraryBookColumnNames.includes('file_path')) {
  // SQLite doesn't easily support changing NOT NULL, but we can try to just use it as nullable
}

const testAttemptColumns = db.prepare("PRAGMA table_info(test_attempts)").all() as any[];
const testAttemptColumnNames = testAttemptColumns.map(c => c.name);
if (!testAttemptColumnNames.includes('is_exam')) db.prepare("ALTER TABLE test_attempts ADD COLUMN is_exam BOOLEAN DEFAULT 0").run();

const existingTestColumns = db.prepare("PRAGMA table_info(tests)").all() as any[];
const existingTestColumnNames = existingTestColumns.map(c => c.name);
if (!existingTestColumnNames.includes('program')) db.prepare("ALTER TABLE tests ADD COLUMN program TEXT").run();
if (!existingTestColumnNames.includes('year')) db.prepare("ALTER TABLE tests ADD COLUMN year TEXT").run();
if (!existingTestColumnNames.includes('group_name')) db.prepare("ALTER TABLE tests ADD COLUMN group_name TEXT").run();

const liveQColumns = db.prepare("PRAGMA table_info(live_questions)").all() as any[];
const liveQColumnNames = liveQColumns.map(c => c.name);
if (!liveQColumnNames.includes('class_id')) db.prepare("ALTER TABLE live_questions ADD COLUMN class_id INTEGER").run();

const attemptColumns = db.prepare("PRAGMA table_info(test_attempts)").all() as any[];
const attemptColumnNames = attemptColumns.map(c => c.name);
if (!attemptColumnNames.includes('grade')) db.prepare("ALTER TABLE test_attempts ADD COLUMN grade INTEGER").run();

const submissionColumns = db.prepare("PRAGMA table_info(submissions)").all() as any[];
const submissionColumnNames = submissionColumns.map(c => c.name);
if (!submissionColumnNames.includes('grade')) db.prepare("ALTER TABLE submissions ADD COLUMN grade INTEGER").run();

const msgColumns = db.prepare("PRAGMA table_info(messages)").all() as any[];
const msgColumnNames = msgColumns.map(c => c.name);
if (!msgColumnNames.includes('chat_type')) db.prepare("ALTER TABLE messages ADD COLUMN chat_type TEXT CHECK(chat_type IN ('PRIVATE', 'CLASS', 'SCHOOL')) DEFAULT 'CLASS'").run();
if (!msgColumnNames.includes('file_url')) db.prepare("ALTER TABLE messages ADD COLUMN file_url TEXT").run();
if (!msgColumnNames.includes('file_name')) db.prepare("ALTER TABLE messages ADD COLUMN file_name TEXT").run();
if (!msgColumnNames.includes('file_type')) db.prepare("ALTER TABLE messages ADD COLUMN file_type TEXT").run();
if (!msgColumnNames.includes('sender_name')) db.prepare("ALTER TABLE messages ADD COLUMN sender_name TEXT").run();
if (!msgColumnNames.includes('sender_role')) db.prepare("ALTER TABLE messages ADD COLUMN sender_role TEXT").run();

const existingScheduleColumns = db.prepare("PRAGMA table_info(schedules)").all() as any[];
const existingScheduleColumnNames = existingScheduleColumns.map(c => c.name);
if (!existingScheduleColumnNames.includes('group_name')) db.prepare("ALTER TABLE schedules ADD COLUMN group_name TEXT").run();

const columns = db.prepare("PRAGMA table_info(assignments)").all() as any[];
const columnNames = columns.map(c => c.name);

if (!columnNames.includes('materials')) {
  db.prepare("ALTER TABLE assignments ADD COLUMN materials TEXT").run();
}
if (!columnNames.includes('max_points')) {
  db.prepare("ALTER TABLE assignments ADD COLUMN max_points INTEGER DEFAULT 100").run();
}
if (!columnNames.includes('submission_type')) {
  db.prepare("ALTER TABLE assignments ADD COLUMN submission_type TEXT CHECK(submission_type IN ('FILE', 'TEXT', 'BOTH')) DEFAULT 'BOTH'").run();
}
if (!columnNames.includes('status')) {
  db.prepare("ALTER TABLE assignments ADD COLUMN status TEXT CHECK(status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')) DEFAULT 'DRAFT'").run();
}
if (!columnNames.includes('program')) db.prepare("ALTER TABLE assignments ADD COLUMN program TEXT").run();
if (!columnNames.includes('year')) db.prepare("ALTER TABLE assignments ADD COLUMN year TEXT").run();
if (!columnNames.includes('group_name')) db.prepare("ALTER TABLE assignments ADD COLUMN group_name TEXT").run();

const notifColumns = db.prepare("PRAGMA table_info(notifications)").all() as any[];
const notifColumnNames = notifColumns.map(c => c.name);
if (!notifColumnNames.includes('target_id')) db.prepare("ALTER TABLE notifications ADD COLUMN target_id TEXT").run();
if (!notifColumnNames.includes('target_type')) db.prepare("ALTER TABLE notifications ADD COLUMN target_type TEXT").run();

// Seed Data
const seed = () => {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  if (userCount.count === 0) {
    const teacherPass = bcrypt.hashSync("mesuesi123", 10);
    const studentPass = bcrypt.hashSync("nxenesi123", 10);

    db.prepare("INSERT INTO users (name, email, password, role, is_confirmed, program, year) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "Prof. Arben Meta", "arben@fshn.edu.al", teacherPass, "TEACHER", 1, "Informatikë", "Viti 1"
    );
    db.prepare("INSERT INTO users (name, email, password, role, class_code, is_confirmed, program, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      "Studenti Shembull", "student@fshnstudent.info", studentPass, "STUDENT", "FSHN-2026", 1, "Informatikë", "Viti 1"
    );

    db.prepare("INSERT INTO tests (title, description, duration, total_points, teacher_id, status, program, year, test_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "Testi i Parë në Analitikë", "Një vlerësim fillestar i njohurive mbi sistemet analitike.", 30, 100, 1, 'ACTIVE', 'Informatikë', 'Viti 1', '2026-03-10 10:00:00'
    );

    db.prepare("INSERT INTO questions (test_id, content, type, options, points, correct_answer) VALUES (?, ?, ?, ?, ?, ?)").run(
      1, "Cila nga këto është një gjuhë programimi për analitikë?", "MCQ", JSON.stringify(["Python", "HTML", "CSS", "Photoshop"]), 50, "Python"
    );
    db.prepare("INSERT INTO questions (test_id, content, type, points) VALUES (?, ?, ?, ?)").run(
      1, "Shpjegoni rëndësinë e analitikës në biznes.", "OPEN", 50
    );

    db.prepare("INSERT INTO assignments (title, description, deadline, teacher_id) VALUES (?, ?, ?, ?)").run(
      "Detyra e Parë: Analiza e Regresionit", "Krijoni një raport mbi zbatimin e regresionit linear në të dhënat e shitjeve.", "2026-03-15 23:59:59", 1
    );

    db.prepare("INSERT INTO submissions (assignment_id, student_id, content) VALUES (?, ?, ?)").run(
      1, 2, "Këtu është raporti im mbi regresionin linear. Kam përdorur metodën e katrorëve më të vegjël për të parashikuar shitjet e muajit të ardhshëm bazuar në trendet e kaluara."
    );

    // Seed Classes (Ensure at least 10)
    const classCount = db.prepare("SELECT COUNT(*) as count FROM classes").get() as any;
    if (classCount.count < 10) {
      const dega = "SHKENCA KOMPJUTERIKE";
      const vitet = ["VITI 1", "VITI 2", "VITI 3"];
      const grupet = ["A", "B", "C"];
      
      for (let i = classCount.count + 1; i <= 10; i++) {
        const vit = vitet[Math.floor(Math.random() * vitet.length)];
        const grup = grupet[Math.floor(Math.random() * grupet.length)];
        db.prepare("INSERT INTO classes (name, code, department, year, group_name, study_type, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
          `Klasa ${i} - ${vit} (${grup})`,
          `KLASA-${1000 + i}`,
          dega,
          vit,
          grup,
          "BACHELOR",
          1
        );
      }
    }

    // Seed Performance Logs
    const students = db.prepare("SELECT id FROM users WHERE role = 'STUDENT'").all() as any[];
    for (const student of students) {
      db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score, timestamp) VALUES (?, 'TEST', ?, 10, datetime('now', '-10 days'))")
        .run(student.id, 7 + Math.floor(Math.random() * 4));
      db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score, timestamp) VALUES (?, 'ASSIGNMENT', ?, 10, datetime('now', '-5 days'))")
        .run(student.id, 6 + Math.floor(Math.random() * 5));
      db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score, timestamp) VALUES (?, 'TEST', ?, 10, datetime('now', '-2 days'))")
        .run(student.id, 8 + Math.floor(Math.random() * 3));
    }
  }
  // Auto-confirm all existing users for development
  db.prepare("UPDATE users SET is_confirmed = 1").run();
};
try {
  seed();
} catch (e) {
  console.error("Seeding failed:", e);
}
};

// Initialize Database before starting the server
// Removed top-level await for Netlify compatibility
// await initDb();

const app = express();

// ULTRA-VERBOSE DEBUG LOGGING FOR NETLIFY
app.use((req, res, next) => {
  if (getIsNetlify()) {
    console.log("--- NETLIFY REQUEST DEBUG ---");
    console.log(`Method: ${req.method}`);
    console.log(`Original URL: ${req.url}`);
    console.log(`Path: ${req.path}`);
    console.log(`Headers: ${JSON.stringify(req.headers)}`);
    console.log("-----------------------------");
  }
  next();
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

app.use((req, res, next) => {
  const originalUrl = req.url;
  const originalMethod = req.method;
  
  // 1. Remove Netlify/Vercel function prefixes
  req.url = req.url.replace(/^\/\.netlify\/functions\/server/, '');
  req.url = req.url.replace(/^\/server/, '');
  
  // 2. Fix double slashes
  req.url = req.url.replace(/\/+/g, '/');
  
  // 3. Ensure it starts with a slash
  if (!req.url.startsWith('/')) req.url = '/' + req.url;

  // 4. Netlify Routing Fix:
  const netlifyPath = req.headers['x-nf-request-uri'] || req.headers['x-netlify-path'];
  if (getIsNetlify()) {
    if (netlifyPath && typeof netlifyPath === 'string') {
      const purePath = netlifyPath.split('?')[0].replace(/\/+/g, '/');
      // If the browser intended for an API route, ensure Express sees it as such
      if (purePath.includes('/api')) {
        const apiIndex = purePath.indexOf('/api');
        req.url = purePath.substring(apiIndex);
      }
    } else if (!req.url.startsWith('/api') && (originalUrl.includes('/api/') || originalUrl.endsWith('/api'))) {
      // Fallback: only prefix if original request clearly intended to visit API
      req.url = '/api' + (req.url === '/' ? '' : req.url);
    }
  }

  // Standard Trailing Slash Fix
  if (req.url.length > 1 && req.url.endsWith('/')) {
    req.url = req.url.slice(0, -1);
  }

  if (originalUrl !== req.url) {
    console.log(`[ROUTE FIX] ${originalMethod} ${originalUrl} -> ${req.url}`);
  }

  next();
});

app.use(async (req, res, next) => {
  try {
    await initDb();
    next();
  } catch (err) {
    console.error("Failed to initialize database in middleware:", err);
    res.status(500).json({ error: "Database initialization failed" });
  }
});

app.use(cors());
app.use(express.json());

// Set Permissions-Policy for browser features
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self), geolocation=(self)');
  next();
});

// Ensure uploads directory exists
const uploadDir = getIsVercel() ? path.join("/tmp", "uploads") : path.join(_dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (req, res) => {
  console.log("Health check request received");
  res.json({ status: "ok", database: db?.name || 'mock' });
});

app.get("/api/test-firestore", async (req, res) => {
  if (!firestore) return res.json({ status: "error", message: "Firestore not initialized" });
  try {
    const snap = await firestore.collection('health').limit(1).get();
    res.json({ status: "ok", count: snap.size });
  } catch (e: any) {
    console.error("Test Firestore Error:", e);
    res.status(500).json({ status: "error", message: e.message, stack: e.stack });
  }
});

// Auth Middleware
const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Pa autorizuar" });
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      let user;
      if (firestore) {
        const userDoc = await firestore.collection('users').doc(decoded.id.toString()).get();
        if (!userDoc.exists) {
          // If missing in Firestore but token is valid, check SQLite for auto-sync during migration
          user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id);
          if (!user) return res.status(401).json({ error: "Përdoruesi nuk u gjet" });
          
          // Auto-sync missing user to new Firestore project
          try {
            await firestore.collection('users').doc(user.id.toString()).set({
              ...user,
              created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Auto-synced user ${user.id} to new Firestore project.`);
          } catch (e) {
            console.error("Auto-sync failed:", e);
          }
        } else {
          user = { id: decoded.id, ...userDoc.data() };
        }
      } else {
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id);
        if (!user) return res.status(401).json({ error: "Përdoruesi nuk u gjet" });
      }
      
      req.user = user;
      next();
    } catch (err) {
      res.status(401).json({ error: "Token i pavlefshëm" });
    }
  };

const handleFirestoreError = (res: any, err: any, context: string) => {
  console.error(`Firestore Error [${context}]:`, err);
  const message = err instanceof Error ? err.message : String(err);
  if (!res.headersSent) {
    return res.status(500).json({ 
      error: "Gabim në Firebase", 
      details: message,
      context
    });
  }
};

const notifyUser = async (userId: string|number, title: string, content: string, type: string = 'SYSTEM', targetId: string|number|null = null, targetType: string|null = null) => {
  if (firestore) {
    try {
      await firestore.collection('notifications').add({
        user_id: userId.toString(),
        title,
        content,
        type,
        target_id: targetId?.toString() || null,
        target_type: targetType || null,
        is_read: false,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error("Firestore notification failed:", e);
    }
  }

  try {
    // Only attempt SQLite if user exists there to avoid FK constraint error
    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (user) {
      db.prepare("INSERT INTO notifications (user_id, title, content, type, target_id, target_type) VALUES (?, ?, ?, ?, ?, ?)")
        .run(userId, title, content, type, targetId, targetType);
    }
  } catch (e) {
    console.error("SQLite notification failed (ignored):", e);
  }
  io.to(`user_${userId}`).emit("new_notification");
};

  // Auth Routes
  app.get("/api/auth/check-class-admin", async (req, res) => {
    const { program, year, study_type, group_name } = req.query;
    
    if (firestore) {
      try {
        if (!program || !year || !study_type || !group_name) {
          return res.json({ hasAdmin: false });
        }
        const classSnap = await firestore.collection('classes')
          .where('department', '==', program)
          .where('year', '==', year)
          .where('study_type', '==', study_type)
          .where('group_name', '==', group_name)
          .get();
        
        const hasAdmin = !classSnap.empty && !!classSnap.docs[0].data().admin_id;
        return res.json({ hasAdmin });
      } catch (e) {
        return handleFirestoreError(res, e, "check-class-admin");
      }
    }

    const classroom = db.prepare("SELECT admin_id FROM classes WHERE department = ? AND year = ? AND study_type = ? AND group_name = ?")
      .get(program, year, study_type, group_name) as any;
    
    res.json({ hasAdmin: !!(classroom && classroom.admin_id) });
  });

  app.post("/api/auth/register", async (req, res) => {
    const { name, surname, email, password, role, program, year, group_name, study_type, phone, is_president } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const logoUrl = "https://i.ibb.co/wFL95wCK/fshnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn.png";

    if (firestore) {
      try {
        const usersRef = firestore.collection('users');
        const userSnap = await usersRef.where('email', '==', email).get();
        if (!userSnap.empty) return res.status(400).json({ error: "Ky email është i regjistruar" });

        const userDoc = usersRef.doc();
        const userId = userDoc.id;
        let isConfirmed = 0;

        const batch = firestore.batch();
        
        if (role === 'STUDENT') {
          const classesRef = firestore.collection('classes');
          const classSnap = await classesRef
            .where('department', '==', program)
            .where('year', '==', year)
            .where('group_name', '==', group_name)
            .where('study_type', '==', study_type)
            .get();

          let classId;
          if (classSnap.empty) {
            const classDoc = classesRef.doc();
            classId = classDoc.id;
            const classCode = `CLASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            batch.set(classDoc, {
              id: classId,
              name: `${program} - ${year}`,
              code: classCode,
              department: program,
              year,
              group_name,
              study_type,
              admin_id: is_president ? userId : null
            });

            if (is_president) {
              isConfirmed = 1;
              batch.set(firestore.collection('class_members').doc(), {
                class_id: classId,
                user_id: userId,
                status: 'CONFIRMED',
                is_admin: 1,
                joined_at: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
              batch.set(firestore.collection('class_members').doc(), {
                class_id: classId,
                user_id: userId,
                status: 'PENDING',
                joined_at: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          } else {
            const classroom = classSnap.docs[0].data();
            classId = classroom.id;
            if (is_president && !classroom.admin_id) {
              isConfirmed = 1;
              batch.update(classesRef.doc(classId), { admin_id: userId });
              batch.set(firestore.collection('class_members').doc(), {
                class_id: classId,
                user_id: userId,
                status: 'CONFIRMED',
                is_admin: 1,
                joined_at: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
              batch.set(firestore.collection('class_members').doc(), {
                class_id: classId,
                user_id: userId,
                status: 'PENDING',
                joined_at: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          }
        } else {
          isConfirmed = 1;
        }

        batch.set(userDoc, {
          id: userId,
          name, surname, email, password: hashedPassword, role, program, year, group_name, study_type, phone,
          is_confirmed: isConfirmed,
          is_class_admin: is_president ? 1 : 0,
          profile_photo: logoUrl,
          email_verified: 1,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        io.emit("student_joined_class");
        return res.json({ message: "Regjistrimi u krye me sukses. Llogaria juaj është në pritje të miratimit nga administratori." });
      } catch (e: any) {
        console.error("Firestore Register Error:", e);
        return res.status(500).json({ error: `Gabim gjatë regjistrimit në Firebase: ${e.message}` });
      }
    }

    try {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      db.transaction(() => {
        const info = db.prepare("INSERT INTO users (name, surname, email, password, role, program, year, group_name, study_type, phone, is_confirmed, profile_photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(name, surname, email, hashedPassword, role, program, year, group_name, study_type, phone, 0, logoUrl);
        
        const userId = info.lastInsertRowid;

        // Create verification token
        const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString();
        db.prepare("INSERT INTO email_verifications (email, token, expires_at) VALUES (?, ?, ?)").run(email, token, expiresAt);

        if (role === 'STUDENT') {
          // Find or create class
          let classroom = db.prepare("SELECT id, admin_id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
            .get(program, year, group_name, study_type) as any;
          
          if (!classroom) {
            // Create class
            const classCode = `CLASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const classInfo = db.prepare("INSERT INTO classes (name, code, department, year, group_name, study_type, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
              .run(`${program} - ${year}`, classCode, program, year, group_name, study_type, is_president ? userId : null);
            
            classroom = { id: classInfo.lastInsertRowid, admin_id: is_president ? userId : null };
            
            if (is_president) {
              db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(userId);
              db.prepare("INSERT INTO class_members (class_id, user_id, status, is_admin) VALUES (?, ?, 'CONFIRMED', 1)")
                .run(classroom.id, userId);
            } else {
              db.prepare("INSERT INTO class_members (class_id, user_id, status) VALUES (?, ?, 'PENDING')")
                .run(classroom.id, userId);
            }
          } else {
            // Class exists
            if (is_president && !classroom.admin_id) {
              // Set as admin if none exists
              db.prepare("UPDATE classes SET admin_id = ? WHERE id = ?").run(userId, classroom.id);
              db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(userId);
              db.prepare("INSERT INTO class_members (class_id, user_id, status, is_admin) VALUES (?, ?, 'CONFIRMED', 1)")
                .run(classroom.id, userId);
            } else {
              // Join as pending
              db.prepare("INSERT INTO class_members (class_id, user_id, status) VALUES (?, ?, 'PENDING')")
                .run(classroom.id, userId);
            }
          }
        } else {
          db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(userId);
        }
        
        db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(userId);
      })();

      io.emit("student_joined_class");
      return res.json({ message: "Regjistrimi u krye me sukses. Llogaria juaj është në pritje të miratimit nga administratori." });
    } catch (err: any) {
      console.error("Register error:", err);
      return res.status(400).json({ error: `Gabim gjatë regjistrimit: ${err.message}` });
    }
  });

  // Email verification routes removed
  app.get("/api/auth/verify-email-json", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (firestore) {
        const verSnap = await firestore.collection('email_verifications').where('token', '==', token).get();
        if (verSnap.empty) return res.status(400).json({ error: "Token i pavlefshëm" });
        
        const verification = verSnap.docs[0].data();
        if (new Date(verification.expires_at) < new Date()) return res.status(400).json({ error: "Token ka skaduar" });

        const userSnap = await firestore.collection('users').where('email', '==', verification.email).get();
        if (!userSnap.empty) {
          await userSnap.docs[0].ref.update({ email_verified: 1 });
        }
        
        await verSnap.docs[0].ref.delete();
      } else {
        const verification = db.prepare("SELECT * FROM email_verifications WHERE token = ?").get(token) as any;
        if (!verification) return res.status(400).json({ error: "Token i pavlefshëm" });
        if (new Date(verification.expires_at) < new Date()) return res.status(400).json({ error: "Token ka skaduar" });

        db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(verification.email);
        db.prepare("DELETE FROM email_verifications WHERE email = ?").run(verification.email);
      }

      res.json({ message: "Verifikimi u krye me sukses" });
    } catch (err: any) {
      console.error("Verify Email JSON Error:", err);
      res.status(500).json({ error: "Gabim gjatë verifikimit." });
    }
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (firestore) {
        const verSnap = await firestore.collection('email_verifications').where('token', '==', token).get();
        if (verSnap.empty) return res.status(400).send("Token i pavlefshëm");
        
        const verification = verSnap.docs[0].data();
        if (new Date(verification.expires_at) < new Date()) return res.status(400).send("Token ka skaduar");

        const userSnap = await firestore.collection('users').where('email', '==', verification.email).get();
        if (!userSnap.empty) {
          await userSnap.docs[0].ref.update({ email_verified: 1 });
        }
        
        await verSnap.docs[0].ref.delete();
      } else {
        const verification = db.prepare("SELECT * FROM email_verifications WHERE token = ?").get(token) as any;
        if (!verification) return res.status(400).send("Token i pavlefshëm");
        if (new Date(verification.expires_at) < new Date()) return res.status(400).send("Token ka skaduar");

        db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(verification.email);
        db.prepare("DELETE FROM email_verifications WHERE email = ?").run(verification.email);
      }

      res.send(`
        <html>
          <head>
            <title>Verifikimi i Suksesshëm</title>
            <style>
              body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
              .card { background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
              h1 { color: #2563eb; margin-bottom: 16px; }
              p { color: #64748b; line-height: 1.6; }
              .btn { display: inline-block; margin-top: 24px; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Verifikimi u krye!</h1>
              <p>Email-i juaj u verifikua me sukses. Tani mund të hyni në platformë dhe të përdorni të gjitha funksionalitetet.</p>
              <a href="/" class="btn">Shko te Faqja Kryesore</a>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("Verify Email Error:", err);
      res.status(500).send("Gabim gjatë verifikimit.");
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      let user: any = null;
      
      if (firestore) {
        const userSnap = await firestore.collection('users').where('email', '==', email).get();
        if (userSnap.empty) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });
        user = userSnap.docs[0].data();
      } else {
        user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
        if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });
      }

      if (user.email_verified) return res.status(400).json({ error: "Email-i është i verifikuar" });

      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString();
      
      if (firestore) {
        await firestore.collection('email_verifications').add({
          email,
          token,
          expires_at: expiresAt,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        db.prepare("INSERT INTO email_verifications (email, token, expires_at) VALUES (?, ?, ?)").run(email, token, expiresAt);
      }

      const transporter = getTransporter();

      const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verifikoni Email-in tuaj - FSHN Student',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">Verifikoni Email-in tuaj</h2>
            <p>Përshëndetje ${user.name},</p>
            <p>Ju lutem klikoni butonin e mëposhtëm për të verifikuar adresën tuaj të email-it:</p>
            <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Verifiko Email-in</a>
            <p>Ky link do të skadojë pas 24 orësh.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      res.json({ message: "Email-i i verifikimit u ridërgua" });
    } catch (err: any) {
      console.error("Resend Verification Error:", err);
      res.status(500).json({ error: "Gabim gjatë dërgimit: " + err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    console.log(`[LOGIN] Request received: ${req.method} ${req.url}`);
    const { email, password } = req.body;
    console.log(`[LOGIN] Request received for: ${email}`);

    if (firestore) {
      try {
        const userSnap = await firestore.collection('users').where('email', '==', email).get();
        if (userSnap.empty) return res.status(401).json({ error: "Email ose fjalëkalim i gabuar" });
        
        const userDoc = userSnap.docs[0];
        const user = userDoc.data();
        
        if (!user.is_confirmed) {
          return res.status(401).json({ error: "Llogaria juaj është në pritje të miratimit nga administratori." });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: "Email ose fjalëkalim i gabuar" });

        // Get class status
        const memberSnap = await firestore.collection('class_members').where('user_id', '==', user.id).get();
        const member = memberSnap.empty ? null : memberSnap.docs[0].data();

        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
        res.json({ 
          token, 
          user: { 
            ...user, 
            class_status: member?.status, 
            is_class_admin: member?.is_admin 
          } 
        });
      } catch (e: any) {
        console.error("Firestore Login Error:", e);
        res.status(500).json({ error: `Gabim gjatë hyrjes në Firebase: ${e.message}` });
      }
      return;
    }

    try {
      console.log("Login attempt for:", email);
      const userDetails = db.prepare(`
        SELECT u.*, cm.status as class_status, cm.is_admin as is_class_admin
        FROM users u
        LEFT JOIN class_members cm ON u.id = cm.user_id
        WHERE u.email = ?
      `).get(email) as any;

      if (!userDetails) {
        console.log("User not found:", email);
        return res.status(401).json({ error: "Kredenciale të gabuara" });
      }

      if (!userDetails.is_confirmed) {
        return res.status(401).json({ error: "Llogaria juaj është në pritje të miratimit nga administratori." });
      }
      
      const isMatch = await bcrypt.compare(password, userDetails.password);
      if (!isMatch) {
        console.log("Invalid password for:", email);
        return res.status(401).json({ error: "Kredenciale të gabuara" });
      }
      
      const token = jwt.sign({ id: userDetails.id, role: userDetails.role, name: userDetails.name }, JWT_SECRET);
      console.log("Login successful for:", email);
      res.json({ 
        token, 
        user: { 
          id: userDetails.id, 
          name: userDetails.name, 
          surname: userDetails.surname,
          role: userDetails.role, 
          email: userDetails.email, 
          program: userDetails.program, 
          year: userDetails.year,
          group_name: userDetails.group_name,
          study_type: userDetails.study_type,
          phone: userDetails.phone,
          profile_photo: userDetails.profile_photo,
          is_confirmed: userDetails.is_confirmed,
          email_verified: userDetails.email_verified,
          class_status: userDetails.class_status,
          is_class_admin: userDetails.is_class_admin
        } 
      });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Gabim i brendshëm i serverit: " + err.message });
    }
  });

  app.post("/api/auth/firebase", async (req, res) => {
    const { email, name, uid } = req.body;

    if (firestore) {
      try {
        let userSnap = await firestore.collection('users').where('email', '==', email).get();
        if (userSnap.empty) {
          // Fallback to SQLite check for migration
          const localUser = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
          if (localUser) {
            // Auto-sync to Firestore
            await firestore.collection('users').doc(localUser.id.toString()).set({
              ...localUser,
              created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Auto-synced user ${localUser.id} via Google Login.`);
            
            // Re-fetch to get query snapshot format or just use the localUser
            userSnap = await firestore.collection('users').where('email', '==', email).get();
          } else {
            return res.status(404).json({ 
              error: "Llogaria nuk u gjet. Ju lutem regjistrohuni më parë duke zgjedhur degën dhe vitin tuaj.",
              email: email,
              name: name
            });
          }
        }
        
        const user = userSnap.docs[0].data();
        const memberSnap = await firestore.collection('class_members').where('user_id', '==', user.id).get();
        const member = memberSnap.empty ? null : memberSnap.docs[0].data();

        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
        res.json({ 
          token, 
          user: { 
            ...user, 
            class_status: member?.status, 
            is_class_admin: member?.is_admin 
          } 
        });
      } catch (e) {
        console.error("Firestore Firebase Auth Error:", e);
        res.status(500).json({ error: "Gabim gjatë hyrjes me Firebase" });
      }
      return;
    }

    try {
      // Check if user exists
      const userDetails = db.prepare(`
        SELECT u.*, cm.status as class_status, cm.is_admin as is_class_admin
        FROM users u
        LEFT JOIN class_members cm ON u.id = cm.user_id
        WHERE u.email = ?
      `).get(email) as any;
      
      if (!userDetails) {
        return res.status(404).json({ 
          error: "Llogaria nuk u gjet. Ju lutem regjistrohuni më parë duke zgjedhur degën dhe vitin tuaj.",
          email: email,
          name: name
        });
      }

      const token = jwt.sign({ id: userDetails.id, role: userDetails.role, name: userDetails.name }, JWT_SECRET);
      res.json({ 
        token, 
        user: { 
          id: userDetails.id, 
          name: userDetails.name, 
          surname: userDetails.surname,
          role: userDetails.role, 
          email: userDetails.email, 
          program: userDetails.program, 
          year: userDetails.year,
          group_name: userDetails.group_name,
          study_type: userDetails.study_type,
          phone: userDetails.phone,
          profile_photo: userDetails.profile_photo,
          is_confirmed: userDetails.is_confirmed,
          email_verified: userDetails.email_verified,
          class_status: userDetails.class_status,
          is_class_admin: userDetails.is_class_admin
        } 
      });
    } catch (err: any) {
      console.error("Firebase Auth Error:", err);
      res.status(500).json({ error: "Gabim gjatë autentikimit me Firebase: " + err.message });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      
      if (!user) {
        // We don't want to reveal if a user exists or not for security
        return res.json({ message: "Nëse ky email ekziston, një link për rivendosjen e fjalëkalimit është dërguar." });
      }

      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

      db.prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)").run(email, token, expiresAt);

      // Email configuration
      const transporter = getTransporter();

      const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Rivendosja e Fjalëkalimit - FSHN Student',
        text: `Përshëndetje ${user.name},\n\nJu keni kërkuar të rivendosni fjalëkalimin tuaj. Ju lutem klikoni në linkun e mëposhtëm për të vazhduar:\n\n${resetUrl}\n\nKy link do të skadojë pas 1 ore.\n\nNëse nuk e keni kërkuar këtë, ju lutem injoroni këtë email.`
      };

      // If no credentials, just log the token for development
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log("--- MOCK EMAIL SENT ---");
        console.log("To:", email);
        console.log("Reset URL:", resetUrl);
        console.log("-----------------------");
      } else {
        await transporter.sendMail(mailOptions);
      }

      res.json({ message: "Nëse ky email ekziston, një link për rivendosjen e fjalëkalimit është dërguar." });
    } catch (err: any) {
      console.error("Forgot password error:", err);
      res.status(500).json({ error: "Gabim i brendshëm: " + err.message });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      const resetRequest: any = db.prepare("SELECT * FROM password_resets WHERE token = ? AND expires_at > ?").get(token, new Date().toISOString());

      if (!resetRequest) {
        return res.status(400).json({ error: "Token i pavlefshëm ose i skaduar" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.prepare("UPDATE users SET password = ? WHERE email = ?").run(hashedPassword, resetRequest.email);
      db.prepare("DELETE FROM password_resets WHERE email = ?").run(resetRequest.email);

      res.json({ message: "Fjalëkalimi u ndryshua me sukses" });
    } catch (err: any) {
      console.error("Reset password error:", err);
      res.status(500).json({ error: "Gabim i brendshëm: " + err.message });
    }
  });

  app.post("/api/auth/send-verification", authenticate, async (req: any, res) => {
    const user = req.user;
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    db.prepare("DELETE FROM email_verification_tokens WHERE user_id = ?").run(user.id);
    db.prepare("INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)")
      .run(user.id, token, expiresAt);

    const transporter = getTransporter();

    const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Verifikoni Email-in tuaj - DIGITAL STUDENT FSHN',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb; text-align: center;">DIGITAL STUDENT FSHN</h2>
          <p>Përshëndetje ${user.name},</p>
          <p>Ju lutem klikoni butonin e mëposhtëm për të verifikuar adresën tuaj të email-it:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verifiko Email</a>
          </div>
          <p>Nëse butoni nuk punon, mund të përdorni këtë link:</p>
          <p style="word-break: break-all; color: #666;">${verificationLink}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">Kjo është një email automatike, ju lutem mos u përgjigjni.</p>
        </div>
      `
    };

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("--- MOCK VERIFICATION EMAIL SENT ---");
      console.log("To:", user.email);
      console.log("Verification Link:", verificationLink);
      console.log("------------------------------------");
      return res.json({ success: true, mock: true, link: verificationLink });
    }

    try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error) {
      console.error("Email send error:", error);
      res.status(500).json({ error: "Gabim gjatë dërgimit të email-it" });
    }
  });

  app.get("/api/auth/verify-email-link", async (req, res) => {
    const { token } = req.query;
    const verification = db.prepare("SELECT user_id FROM email_verification_tokens WHERE token = ? AND expires_at > datetime('now')").get(token) as any;
    
    if (!verification) {
      return res.status(400).json({ error: "Token i pavlefshëm ose i skaduar" });
    }

    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(verification.user_id);
    db.prepare("DELETE FROM email_verification_tokens WHERE token = ?").run(token);
    
    res.json({ success: true });
  });

  // Teacher confirmation routes
  app.get("/api/teacher/pending-students", authenticate, (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const students = db.prepare("SELECT id, name, email, program, year FROM users WHERE role = 'STUDENT' AND is_confirmed = 0").all();
    res.json(students);
  });

  app.post("/api/teacher/confirm-student", authenticate, (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { studentId } = req.body;
    db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(studentId);
    res.json({ success: true });
  });

  // Admin & Approval Routes
  app.get("/api/admin/pending-members", authenticate, async (req: any, res) => {
    // Check if user is admin of any class OR a teacher of any class
    let classIds: any[] = [];
    
    if (firestore) {
      try {
        if (req.user.role === 'TEACHER') {
          const teacherClasses = await firestore.collection('teacher_schedule').where('teacher_id', '==', req.user.id.toString()).get();
          classIds = teacherClasses.docs.map(d => d.data().class_id);
        } else {
          const adminClasses = await firestore.collection('classes').where('admin_id', '==', req.user.id.toString()).get();
          classIds = adminClasses.docs.map(d => d.id);
        }
      } catch (e) {
        console.error("Firestore pending members class lookup error:", e);
      }
    }

    if (classIds.length === 0) {
      if (req.user.role === 'TEACHER') {
        const teacherClasses = db.prepare("SELECT class_id FROM teacher_schedule WHERE teacher_id = ?").all(req.user.id) as any[];
        classIds = teacherClasses.map(c => c.class_id);
      } else {
        const adminClasses = db.prepare("SELECT id FROM classes WHERE admin_id = ?").all(req.user.id) as any[];
        classIds = adminClasses.map(c => c.id);
      }
    }

    if (classIds.length === 0) return res.json([]);

    if (firestore) {
      try {
        // Firestore 'in' limit is 30
        const chunkedClassIds = [];
        for (let i = 0; i < classIds.length; i += 30) {
          chunkedClassIds.push(classIds.slice(i, i + 30));
        }

        let pending: any[] = [];
        for (const chunk of chunkedClassIds) {
          const pendingSnap = await firestore.collection('class_members')
            .where('class_id', 'in', chunk)
            .where('status', '==', 'PENDING')
            .get();
          
          const chunkPending = await Promise.all(pendingSnap.docs.map(async d => {
            const data = d.data();
            const userSnap = await firestore.collection('users').doc(data.user_id).get();
            const classSnap = await firestore.collection('classes').doc(data.class_id).get();
            const userData = userSnap.data();
            const classData = classSnap.data();
            return {
              id: d.id,
              ...data,
              name: userData?.name,
              surname: userData?.surname,
              email: userData?.email,
              class_name: classData?.name
            };
          }));
          pending = pending.concat(chunkPending);
        }
        return res.json(pending);
      } catch (e) {
        console.error("Firestore pending members fetch error:", e);
      }
    }

    // Chunk classIds to avoid "Too many parameter values" error (limit is 999)
    const chunkSize = 900;
    let pending: any[] = [];
    
    for (let i = 0; i < classIds.length; i += chunkSize) {
      const chunk = classIds.slice(i, i + chunkSize);
      const chunkPending = db.prepare(`
        SELECT cm.*, u.name, u.surname, u.email, c.name as class_name
        FROM class_members cm
        JOIN users u ON cm.user_id = u.id
        JOIN classes c ON cm.class_id = c.id
        WHERE cm.class_id IN (${chunk.map(() => '?').join(',')}) AND cm.status = 'PENDING'
      `).all(...chunk);
      pending = pending.concat(chunkPending);
    }
    
    res.json(pending);
  });

  app.post("/api/admin/self-confirm", authenticate, async (req: any, res) => {
    // Only allow if user is a class admin/president and not confirmed
    if (!req.user.is_class_admin) return res.status(403).json({ error: "Vetëm mësuesit ose presidentët e klasave mund të konfirmojnë llogarinë e tyre." });

    if (firestore) {
      try {
        const userRef = firestore.collection('users').doc(req.user.id.toString());
        await userRef.update({ is_confirmed: 1 });
        
        // Also update class member status if exists
        const membersSnap = await firestore.collection('class_members')
          .where('user_id', '==', req.user.id.toString())
          .get();
        
        if (!membersSnap.empty) {
          const batch = firestore.batch();
          membersSnap.docs.forEach(doc => {
            batch.update(doc.ref, { status: 'CONFIRMED' });
          });
          await batch.commit();
        }
      } catch (e) {
        console.error("Self confirm error:", e);
      }
    }

    db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(req.user.id);
    db.prepare("UPDATE class_members SET status = 'CONFIRMED' WHERE user_id = ?").run(req.user.id);

    res.json({ success: true });
  });

  app.post("/api/admin/approve-all", authenticate, async (req: any, res) => {
    // Find all pending members for classes this user manages
    let classIds: any[] = [];
    if (firestore) {
      try {
        const adminClasses = await firestore.collection('classes').where('admin_id', '==', req.user.id.toString()).get();
        classIds = adminClasses.docs.map(d => d.id);
        
        if (classIds.length > 0) {
          const batch = firestore.batch();
          const pendingSnap = await firestore.collection('class_members')
            .where('class_id', 'in', classIds)
            .where('status', '==', 'PENDING')
            .get();
          
          for (const d of pendingSnap.docs) {
            batch.update(d.ref, { status: 'CONFIRMED' });
            batch.update(firestore.collection('users').doc(d.data().user_id.toString()), { is_confirmed: 1 });
          }
          await batch.commit();
        }
      } catch (e) {
        console.error("Approve all error:", e);
      }
    }

    const adminClasses = db.prepare("SELECT id FROM classes WHERE admin_id = ?").all(req.user.id) as any[];
    classIds = adminClasses.map(c => c.id);

    if (classIds.length > 0) {
      const pending = db.prepare(`SELECT user_id FROM class_members WHERE class_id IN (${classIds.map(() => '?').join(',')}) AND status = 'PENDING'`).all(...classIds) as any[];
      
      db.transaction(() => {
        db.prepare(`UPDATE class_members SET status = 'CONFIRMED' WHERE class_id IN (${classIds.map(() => '?').join(',')}) AND status = 'PENDING'`).run(...classIds);
        for (const p of pending) {
          db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(p.user_id);
        }
      })();
    }

    res.json({ success: true });
  });

  app.post("/api/admin/approve-member", authenticate, async (req: any, res) => {
    const { memberId, status } = req.body; // status: 'CONFIRMED' or 'REFUSED'
    
    let member: any = null;
    let classroom: any = null;

    if (firestore) {
      try {
        const memberRef = firestore.collection('class_members').doc(memberId);
        const memberSnap = await memberRef.get();
        if (memberSnap.exists) {
          member = { id: memberSnap.id, ...memberSnap.data() };
          const classSnap = await firestore.collection('classes').doc(member.class_id).get();
          if (classSnap.exists) {
            classroom = { id: classSnap.id, ...classSnap.data() };
          }
        }
      } catch (e) {
        console.error("Firestore approve member lookup error:", e);
      }
    }

    if (!member) {
      member = db.prepare("SELECT * FROM class_members WHERE id = ?").get(memberId) as any;
      if (member) {
        classroom = db.prepare("SELECT admin_id FROM classes WHERE id = ?").get(member.class_id) as any;
      }
    }

    if (!member) return res.status(404).json({ error: "Anëtari nuk u gjet" });

    // Check if requester is admin of this class OR a teacher of this class
    let isAuthorized = false;
    
    if (classroom?.admin_id?.toString() === req.user.id.toString()) {
      isAuthorized = true;
    } else if (req.user.role === 'TEACHER') {
      if (firestore) {
        const tsSnap = await firestore.collection('teacher_schedule')
          .where('teacher_id', '==', req.user.id.toString())
          .where('class_id', '==', member.class_id.toString())
          .get();
        if (!tsSnap.empty) isAuthorized = true;
      }
      if (!isAuthorized) {
        const isTeacher = db.prepare("SELECT id FROM teacher_schedule WHERE teacher_id = ? AND class_id = ?").get(req.user.id, member.class_id);
        if (isTeacher) isAuthorized = true;
      }
    }

    if (!isAuthorized) return res.status(403).json({ error: "Pa autorizuar" });

    if (firestore) {
      try {
        const batch = firestore.batch();
        batch.update(firestore.collection('class_members').doc(memberId), { status });
        if (status === 'CONFIRMED') {
          batch.update(firestore.collection('users').doc(member.user_id.toString()), { is_confirmed: 1 });
        }
        
        const title = status === 'CONFIRMED' ? "Kërkesa u Pranua" : "Kërkesa u Refuzua";
        const content = status === 'CONFIRMED' 
          ? "Urime! Jeni pranuar në klasë." 
          : "Kërkesa juaj për t'u bashkuar me klasën u refuzua. Ju lutem zgjidhni një klasë tjetër.";
        
        batch.set(firestore.collection('notifications').doc(), {
          user_id: member.user_id.toString(),
          title,
          content,
          type: 'SYSTEM',
          is_read: false,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
        io.to(`user_${member.user_id}`).emit("new_notification");
        io.to(`user_${member.user_id}`).emit("member_status_updated", { status });
        io.emit("student_joined_class");
        return res.json({ success: true });
      } catch (e) {
        console.error("Firestore approve member update error:", e);
      }
    }

    try {
      db.transaction(() => {
        // Only run SQLite updates if the member/user exists in SQLite
        const sqliteMember = db.prepare("SELECT id, user_id FROM class_members WHERE id = ?").get(memberId);
        if (sqliteMember) {
          db.prepare("UPDATE class_members SET status = ? WHERE id = ?").run(status, memberId);
          
          const sqliteUser = db.prepare("SELECT id FROM users WHERE id = ?").get(sqliteMember.user_id);
          if (sqliteUser) {
            if (status === 'CONFIRMED') {
              db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(sqliteMember.user_id);
            }
            
            const title = status === 'CONFIRMED' ? "Kërkesa u Pranua" : "Kërkesa u Refuzua";
            const content = status === 'CONFIRMED' 
              ? "Urime! Jeni pranuar në klasë." 
              : "Kërkesa juaj për t'u bashkuar me klasën u refuzua. Ju lutem zgjidhni një klasë tjetër.";
            
            db.prepare("INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, ?)")
              .run(sqliteMember.user_id, title, content, 'SYSTEM');

            io.to(`user_${sqliteMember.user_id}`).emit("new_notification");
            io.to(`user_${sqliteMember.user_id}`).emit("member_status_updated", { status });
            io.emit("student_joined_class");
          }
        }
      })();
    } catch (e) {
      console.error("SQLite approve member update error (ignored):", e);
    }

    res.json({ success: true });
  });

  app.post("/api/student/change-classroom", authenticate, async (req: any, res) => {
    const { program, year, group_name, study_type } = req.body;
    
    if (firestore) {
      try {
        const classesRef = firestore.collection('classes');
        const classSnap = await classesRef
          .where('department', '==', program)
          .where('year', '==', year)
          .where('group_name', '==', group_name)
          .where('study_type', '==', study_type)
          .get();
        
        if (!classSnap.empty) {
          const classId = classSnap.docs[0].id;
          const batch = firestore.batch();
          
          // Delete old members
          const oldMembers = await firestore.collection('class_members').where('user_id', '==', req.user.id.toString()).get();
          oldMembers.forEach(d => batch.delete(d.ref));
          
          // Update user
          batch.update(firestore.collection('users').doc(req.user.id.toString()), {
            program, year, group_name, study_type, is_confirmed: 0
          });
          
          // New member
          batch.set(firestore.collection('class_members').doc(), {
            class_id: classId,
            user_id: req.user.id.toString(),
            status: 'PENDING',
            joined_at: admin.firestore.FieldValue.serverTimestamp()
          });
          
          await batch.commit();
        }
      } catch (e) {
        console.error("Firestore change classroom error:", e);
      }
    }

    try {
      db.transaction(() => {
        // Remove from old class
        db.prepare("DELETE FROM class_members WHERE user_id = ?").run(req.user.id);
        
        // Update user info
        db.prepare("UPDATE users SET program = ?, year = ?, group_name = ?, study_type = ?, is_confirmed = 0 WHERE id = ?")
          .run(program, year, group_name, study_type, req.user.id);
        
        // Join new class
        let classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
          .get(program, year, group_name, study_type) as any;
        
        if (!classroom) {
          const classCode = `CLASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const classInfo = db.prepare("INSERT INTO classes (name, code, department, year, group_name, study_type, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(`${program} - ${year}`, classCode, program, year, group_name, study_type, req.user.id);
          
          classroom = { id: classInfo.lastInsertRowid };
          db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(req.user.id);
          db.prepare("INSERT INTO class_members (class_id, user_id, status, is_admin) VALUES (?, ?, 'CONFIRMED', 1)")
            .run(classroom.id, req.user.id);
        } else {
          db.prepare("INSERT INTO class_members (class_id, user_id, status) VALUES (?, ?, 'PENDING')")
            .run(classroom.id, req.user.id);
        }
        
        // Add notification
        notifyUser(req.user.id, "Klasa u Ndryshua", "Keni ndryshuar klasën. Ju lutem prisni miratimin nga administratori i klasës së re.", 'SYSTEM');
      })();
    } catch (e) {
      console.error("SQLite change classroom error (ignored):", e);
    }
    
    io.emit("student_joined_class");
    res.json({ success: true });
  });

  // Lecture Status Routes
  const ALBANIAN_DAYS = ['E Dielë', 'E Hënë', 'E Martë', 'E Mërkurë', 'E Enjte', 'E Premte', 'E Shtunë'];

  app.get("/api/dashboard/teacher", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    
    try {
      // 1. Current Lecture
      const now = new Date();
      const dayIndex = now.getDay();
      const dayName = ALBANIAN_DAYS[dayIndex];
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      let currentLecture = null;
      let dailySchedule: any[] = [];
      let stats: any = null;
      let pendingSubmissions: any[] = [];
      let notifications: any[] = [];
      let pendingStudents: any[] = [];
      let allClasses: any[] = [];

      if (firestore) {
        try {
          const nowStr = time;
          const [h, m] = nowStr.split(':').map(Number);
          
          // Parallel fetch for speed
          const [schedsSnap, calSnap, statsTestSnap, pendingAsSnap, pendingTsSnap, notifsSnap, pStudentsSnap, classesSnap, allTeacherSchedsSnap, allSchedulesSnap] = await Promise.all([
             firestore.collection('teacher_schedule')
               .where('teacher_id', '==', req.user.id.toString())
               .where('day_of_week', '==', dayIndex)
               .get(),
             firestore.collection('schedules')
               .where('teacher_id', '==', req.user.id.toString())
               .where('day_of_week', '==', dayName)
               .get(),
             firestore.collection('tests')
               .where('teacher_id', '==', req.user.id.toString())
               .where('status', '==', 'ACTIVE')
               .get(),
             firestore.collection('submissions')
               .where('status', '==', 'SUBMITTED')
               .get(),
             firestore.collection('test_attempts')
               .where('status', '==', 'SUBMITTED')
               .get(),
             firestore.collection('notifications')
               .where('user_id', '==', req.user.id.toString())
               .limit(20)
               .get(),
             firestore.collection('class_members')
               .where('status', '==', 'PENDING')
               .get(),
             firestore.collection('classes')
               .where('teacher_id', '==', req.user.id.toString())
               .get(),
             firestore.collection('teacher_schedule')
               .where('teacher_id', '==', req.user.id.toString())
               .get(),
             firestore.collection('schedules')
               .where('teacher_id', '==', req.user.id.toString())
               .get()
          ]);

          // Current Lecture
          const schedules = schedsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          currentLecture = schedules.find((s: any) => s.start_time <= nowStr && s.end_time >= nowStr);
          
          if (!currentLecture) {
            const calSchedules = calSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            currentLecture = calSchedules.find((s: any) => s.start_time <= nowStr && s.end_time >= nowStr);
          }

          if (currentLecture) {
             const lsSnap = await firestore.collection('lecture_status')
               .where('schedule_id', '==', currentLecture.id.toString())
               .get();
             const today = new Date().toISOString().split('T')[0];
             const todayStatus = lsSnap.docs.find(doc => doc.data().updated_at?.toDate().toISOString().startsWith(today));
             currentLecture.status = todayStatus ? todayStatus.data().status : null;
          }

          dailySchedule = schedules.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
          
          const allPendingAs = pendingAsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const allPendingTs = pendingTsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Stats
          const testCount = statsTestSnap.size;
          
          // Calculate average score from test attempts
          const attempts = allPendingTs; // These are test attempts
          let avg = 85; 
          if (attempts.length > 0) {
            const sum = attempts.reduce((acc: number, curr: any) => acc + (curr.total_score || curr.score || 0), 0);
            avg = Math.round(sum / attempts.length);
          }
          
          // More complex analytics for Firestore
          const logsSnap = await firestore.collection('performance_logs').orderBy('timestamp', 'desc').limit(50).get();
          const logs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Calculate classProgress from logs
          const monthlyProgress: Record<string, { sum: number, count: number }> = {};
          logs.forEach((log: any) => {
            const date = log.timestamp?.toDate?.() || new Date(log.timestamp);
            if (date && !isNaN(date.getTime())) {
              const month = date.toISOString().slice(0, 7); // YYYY-MM
              if (!monthlyProgress[month]) monthlyProgress[month] = { sum: 0, count: 0 };
              monthlyProgress[month].sum += (log.score || 0) / (log.max_score || 100);
              monthlyProgress[month].count++;
            }
          });

          const classProgress = Object.entries(monthlyProgress)
            .map(([month, data]) => ({ month, avg_perf: data.sum / data.count }))
            .sort((a, b) => a.month.localeCompare(b.month));

          stats = { 
            averageScore: avg, 
            activeTestsCount: testCount, 
            logs: logs.slice(0, 10), 
            topImprovers: [], 
            classProgress: classProgress.length > 0 ? classProgress : [{ month: dayName, avg_perf: 0.85 }]
          };

          // Pending Submissions
          // We need to filter by teacher's items
          const teacherAssignmentsSnap = await firestore.collection('assignments').where('teacher_id', '==', req.user.id.toString()).get();
          const teacherTestsSnap = await firestore.collection('tests').where('teacher_id', '==', req.user.id.toString()).get();
          
          const teacherAssignmentIds = teacherAssignmentsSnap.docs.map(d => d.id);
          const teacherTestIds = teacherTestsSnap.docs.map(d => d.id);
          
          const filteredPendingAs = allPendingAs.filter((s: any) => teacherAssignmentIds.includes(s.assignment_id?.toString()));
          const filteredPendingTs = allPendingTs.filter((s: any) => teacherTestIds.includes(s.test_id?.toString()));

          // Augment with student names and titles in parallel
          const pendingSubmissionsList = await Promise.all(
            [...filteredPendingAs.map(x => ({...x, type: 'ASSIGNMENT'})), ...filteredPendingTs.map(x => ({...x, type: 'TEST'}))]
              .map(async (s) => {
                try {
                  const studentDoc = await firestore.collection('users').doc(s.student_id?.toString() || s.user_id?.toString()).get();
                  const studentData = studentDoc.data();
                  const targetDoc = s.type === 'ASSIGNMENT' 
                    ? teacherAssignmentsSnap.docs.find(d => d.id === s.assignment_id?.toString())
                    : teacherTestsSnap.docs.find(d => d.id === s.test_id?.toString());
                  
                  return {
                    id: s.id,
                    type: s.type,
                    target_id: s.assignment_id || s.test_id,
                    submitted_at: s.submitted_at || s.timestamp || s.end_time,
                    student_name: studentData ? `${studentData.name} ${studentData.surname || ''}` : 'Student i panjohur',
                    title: targetDoc?.data().title || 'E panjohur',
                    is_late: s.is_late
                  };
                } catch (e) {
                  console.error("Error fetching student/target doc for submission:", s.id, e);
                  return null;
                }
              })
          );
          
          pendingSubmissions = pendingSubmissionsList.filter(Boolean);
          
          notifications = notifsSnap.docs
            .map(doc => {
              const d = doc.data();
              return { 
                id: doc.id, 
                ...d,
                created_at: d.created_at?.toDate?.() ? d.created_at.toDate().toISOString() : d.created_at
              };
            })
            .sort((a: any, b: any) => {
              const valA = new Date(a.created_at).getTime() || 0;
              const valB = new Date(b.created_at).getTime() || 0;
              return valB - valA;
            })
            .slice(0, 10);
          
          // Improve allClasses to include classes from ALL schedules (any day)
          const directClasses = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          const teacherScheds = allTeacherSchedsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const allSchedules = allSchedulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          const allRelevantSchedules = [...teacherScheds, ...allSchedules];
          
          const scheduledClassIds = [...new Set(allRelevantSchedules.map((s: any) => s.class_id?.toString()).filter(Boolean))];
          
          // Fetch additional classes from schedules if not already in directClasses
          const missingClassIds = scheduledClassIds.filter(id => !directClasses.some(c => c.id.toString() === id));
          
          let additionalClasses: any[] = [];
          if (missingClassIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < missingClassIds.length; i += 10) {
              chunks.push(missingClassIds.slice(i, i + 10));
            }
            const extraSnaps = await Promise.all(chunks.map(chunk => 
              firestore.collection('classes').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get()
            ));
            extraSnaps.forEach(snap => {
              snap.docs.forEach(doc => additionalClasses.push({ id: doc.id, ...doc.data() }));
            });
          }
          
          // Combine found classes
          let combinedClasses = [...directClasses, ...additionalClasses];
          
          // For any schedule that STILL doesn't have a class in combinedClasses (e.g. no class_id or class not found)
          // we create a virtual class object for it
          allRelevantSchedules.forEach((s: any) => {
            const hasClass = combinedClasses.some(c => c.id.toString() === (s.class_id?.toString() || `VIRT_${s.id}`));
            if (!hasClass && !s.class_id) {
               // Create a virtual class object
               combinedClasses.push({
                 id: `VIRT_${s.id}`,
                 name: `${s.program} - ${s.year} ${s.group_name || ''}`.trim(),
                 department: s.program,
                 year: s.year,
                 group_name: s.group_name,
                 virtual: true,
                 subject: s.subject
               });
            }
          });
          
          allClasses = combinedClasses;
          
          // Filter pending students by teacher's classes
          const teacherClassIds = allClasses.map((c: any) => c.id.toString());
          pendingStudents = pStudentsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((ms: any) => teacherClassIds.includes(ms.class_id?.toString()));

        } catch (e) {
          console.error("Dashboard Firestore Error:", e);
        }
      } else {
        const sched = db.prepare(`
          SELECT ts.*, c.name as class_name, ls.status
          FROM teacher_schedule ts
          JOIN classes c ON ts.class_id = c.id
          LEFT JOIN lecture_status ls ON ts.id = ls.schedule_id AND date(ls.updated_at) = date('now')
          WHERE ts.teacher_id = ? AND ts.day_of_week = ? AND ts.start_time <= ? AND ts.end_time >= ?
        `).get(req.user.id, dayIndex, time, time) as any;
        
        if (sched) {
          currentLecture = sched;
        } else {
          const scheduled = db.prepare(`
            SELECT s.*, c.id as class_id, c.name as class_name
            FROM schedules s
            JOIN classes c ON (s.program = c.department AND s.year = c.year AND (s.group_name = c.group_name OR s.group_name IS NULL OR c.group_name IS NULL))
            WHERE s.teacher_id = ? AND s.day_of_week = ? AND s.start_time <= ? AND s.end_time >= ?
          `).get(req.user.id, dayName, time, time) as any;

          if (scheduled) {
            const ls = db.prepare("SELECT status FROM lecture_status WHERE schedule_id = ? AND date(updated_at) = date('now')")
              .get(scheduled.id) as any;
            currentLecture = { ...scheduled, status: ls ? ls.status : null };
          }
        }
      }

      // 2. Daily Schedule
      if (!firestore) {
        dailySchedule = db.prepare(`
          SELECT ts.*, c.name as class_name, ls.status
          FROM teacher_schedule ts
          JOIN classes c ON ts.class_id = c.id
          LEFT JOIN lecture_status ls ON ts.id = ls.schedule_id AND date(ls.updated_at) = date('now')
          WHERE ts.teacher_id = ? AND ts.day_of_week = ?
          ORDER BY ts.start_time ASC
        `).all(req.user.id, dayIndex);
      }

      // 3. Analytics
      if (firestore) {
        try {
          const logsSnap = await firestore.collection('performance_logs')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();
          
          const logs = await Promise.all(logsSnap.docs.map(async doc => {
             const logId = doc.id;
             const d = doc.data();
             const [likesSnap, commentsSnap, myLikeDoc, myFavoriteDoc] = await Promise.all([
               firestore.collection('performance_logs').doc(logId).collection('likes').get(),
               firestore.collection('performance_logs').doc(logId).collection('comments').get(),
               firestore.collection('performance_logs').doc(logId).collection('likes').doc(req.user.id.toString()).get(),
               firestore.collection('performance_logs').doc(logId).collection('favorites').doc(req.user.id.toString()).get()
             ]);

             return { 
               id: logId, 
               ...d,
               likes_count: likesSnap.size,
               comments_count: commentsSnap.size,
               is_liked: myLikeDoc.exists,
               is_favorite: myFavoriteDoc.exists,
               timestamp: d.timestamp?.toDate?.() ? d.timestamp.toDate().toISOString() : d.timestamp
             };
          }));

          const testsSnap = await firestore.collection('tests')
            .where('teacher_id', '==', req.user.id.toString())
            .where('status', '==', 'ACTIVE')
            .get();

          // Calculate monthly progress
          const monthlyProgress: { [key: string]: { sum: number, count: number } } = {};
          let totalSum = 0;
          let totalCount = 0;

          logs.forEach(log => {
            if (log.score !== undefined && log.max_score > 0) {
              const perf = Number(log.score) / Number(log.max_score);
              totalSum += perf;
              totalCount++;

              const date = new Date(log.timestamp);
              const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
              if (!monthlyProgress[monthKey]) monthlyProgress[monthKey] = { sum: 0, count: 0 };
              monthlyProgress[monthKey].sum += perf;
              monthlyProgress[monthKey].count++;
            }
          });

          const classProgress = Object.entries(monthlyProgress)
            .map(([month, data]) => ({ month, avg_perf: data.sum / data.count }))
            .sort((a, b) => a.month.localeCompare(b.month));

          const averageScore = totalCount > 0 ? (totalSum / totalCount) * 100 : 85;
          
          stats = { 
            averageScore, 
            classProgress: classProgress.length > 0 ? classProgress : [{ month: new Date().toISOString().slice(0, 7), avg_perf: averageScore / 100 }], 
            topImprovers: [], 
            logs: logs.slice(0, 10), 
            activeTestsCount: testsSnap.size 
          };
        } catch (e) {
          console.error("Teacher dashboard analytics error:", e);
          stats = { averageScore: 0, classProgress: [], topImprovers: [], logs: [], activeTestsCount: 0 };
        }
      } else {
        const topImprovers = db.prepare(`
          SELECT u.id, u.name, u.surname, AVG(CAST(score AS FLOAT)/max_score) as avg_perf 
          FROM performance_logs pl
          JOIN users u ON pl.user_id = u.id
          GROUP BY pl.user_id ORDER BY avg_perf DESC LIMIT 10
        `).all() as any[];
        
        const classProgress = db.prepare(`
          SELECT strftime('%Y-%m', timestamp) as month, AVG(CAST(score AS FLOAT)/max_score) as avg_perf 
          FROM performance_logs pl
          GROUP BY month ORDER BY month ASC
        `).all() as any[];

        const logs = db.prepare(`
          SELECT pl.*, 
                 (SELECT COUNT(*) FROM activity_likes WHERE activity_id = pl.id) as likes_count,
                 (SELECT COUNT(*) FROM activity_comments WHERE activity_id = pl.id) as comments_count,
                 EXISTS(SELECT 1 FROM activity_likes WHERE activity_id = pl.id AND user_id = ?) as is_liked,
                 EXISTS(SELECT 1 FROM activity_favorites WHERE activity_id = pl.id AND user_id = ?) as is_favorite
          FROM performance_logs pl 
          ORDER BY timestamp DESC LIMIT 20
        `).all(req.user.id, req.user.id);
        const activeTests = db.prepare("SELECT COUNT(*) as count FROM tests WHERE teacher_id = ? AND status = 'ACTIVE'").get(req.user.id) as any;
        
        const averageScore = classProgress.reduce((acc, curr) => acc + curr.avg_perf, 0) / (classProgress.length || 1);
        stats = { averageScore: averageScore * 100, classProgress, topImprovers, logs, activeTestsCount: activeTests.count };
      }

      // 4. Pending Submissions
      if (!firestore) {
        const pAs = db.prepare(`
          SELECT s.id, s.submitted_at, s.assignment_id as target_id, 'ASSIGNMENT' as type, 
                 (u.name || ' ' || COALESCE(u.surname, '')) as student_name, a.title as title
          FROM submissions s
          JOIN assignments a ON s.assignment_id = a.id
          JOIN users u ON s.student_id = u.id
          WHERE a.teacher_id = ? AND s.status = 'SUBMITTED'
        `).all(req.user.id);
        
        const pTs = db.prepare(`
          SELECT ta.id, ta.end_time as submitted_at, ta.test_id as target_id, 'TEST' as type,
                 (u.name || ' ' || COALESCE(u.surname, '')) as student_name, t.title as title
          FROM test_attempts ta
          JOIN tests t ON ta.test_id = t.id
          JOIN users u ON ta.user_id = u.id
          WHERE t.teacher_id = ? AND ta.status = 'SUBMITTED'
        `).all(req.user.id);
        pendingSubmissions = [...pAs, ...pTs];
      }

      // 5. Notifications
      if (!firestore) {
        notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10").all(req.user.id);
      }

      // 6. Pending Students & Classes
      if (!firestore) {
        pendingStudents = db.prepare(`
          SELECT u.*, c.name as class_name, cm.id as member_id
          FROM class_members cm
          JOIN users u ON cm.user_id = u.id
          JOIN classes c ON cm.class_id = c.id
          WHERE c.teacher_id = ? AND cm.status = 'PENDING'
        `).all(req.user.id);
        
        const directClasses = db.prepare("SELECT * FROM classes WHERE teacher_id = ?").all(req.user.id);
        const scheduledClasses = db.prepare(`
          SELECT c.* 
          FROM classes c
          JOIN teacher_schedule ts ON c.id = ts.class_id
          WHERE ts.teacher_id = ?
        `).all(req.user.id);
        
        const standaloneSchedules = db.prepare(`
          SELECT id, subject, program, year, group_name 
          FROM teacher_schedule 
          WHERE teacher_id = ? AND (class_id IS NULL OR class_id NOT IN (SELECT id FROM classes))
        `).all(req.user.id);
        
        const virtualClasses = standaloneSchedules.map((s: any) => ({
          id: `VIRT_${s.id}`,
          name: `${s.subject || s.program} - ${s.year}`,
          department: s.program,
          year: s.year,
          group_name: s.group_name,
          virtual: true
        }));

        const seenIds = new Set();
        allClasses = [];
        [...directClasses, ...scheduledClasses, ...virtualClasses].forEach((c: any) => {
          if (!seenIds.has(c.id)) {
            seenIds.add(c.id);
            allClasses.push(c);
          }
        });
      }

      res.json({
        currentLecture,
        dailySchedule,
        stats,
        pendingSubmissions,
        notifications,
        pendingStudents,
        allClasses
      });
    } catch (err: any) {
      console.error("Teacher Dashboard Bulk Fetch Error:", err);
      res.status(500).json({ error: "Gabim në ngarkimin e të dhënave të dashboardit" });
    }
  });

  app.get("/api/dashboard/student", authenticate, async (req: any, res) => {
    if (req.user.role !== 'STUDENT') return res.status(403).json({ error: "Pa autorizuar" });

    try {
      // 1. Stats & Analytics
      let stats = null;
      if (firestore) {
        try {
          const userIdStr = req.user.id.toString();
          const userIdNum = parseInt(req.user.id);

          const ids = [userIdStr, userIdNum].filter(v => typeof v !== 'undefined' && v !== null && !isNaN(v as any));
          
          let logs: any[] = [];
          let perfLogs: any[] = [];
          if (ids.length > 0) {
            const [logsSnap, assignmentsSnap, testsSnap] = await Promise.all([
              firestore.collection('performance_logs').where('user_id', 'in', ids).get(),
              firestore.collection('assignments')
                .where('status', '==', 'PUBLISHED')
                .where('program', '==', (req.user.program || '').trim().toUpperCase())
                .where('year', '==', (req.user.year || '').trim().toUpperCase())
                .get(),
              firestore.collection('tests')
                .where('status', '==', 'ACTIVE')
                .where('program', '==', (req.user.program || '').trim().toUpperCase())
                .where('year', '==', (req.user.year || '').trim().toUpperCase())
                .get()
            ]);
            
            perfLogs = await Promise.all(logsSnap.docs.map(async doc => {
               const logId = doc.id;
               const d = doc.data();
               const [likesSnap, commentsSnap, myLikeDoc, myFavoriteDoc] = await Promise.all([
                 firestore.collection('performance_logs').doc(logId).collection('likes').get(),
                 firestore.collection('performance_logs').doc(logId).collection('comments').get(),
                 firestore.collection('performance_logs').doc(logId).collection('likes').doc(req.user.id.toString()).get(),
                 firestore.collection('performance_logs').doc(logId).collection('favorites').doc(req.user.id.toString()).get()
               ]);

               return { 
                 id: logId, 
                 ...d,
                 likes_count: likesSnap.size,
                 comments_count: commentsSnap.size,
                 is_liked: myLikeDoc.exists,
                 is_favorite: myFavoriteDoc.exists,
                 timestamp: d.timestamp?.toDate?.() ? d.timestamp.toDate().toISOString() : d.timestamp
               };
            }));

            // Map assignments to log items
            const assignmentLogs = assignmentsSnap.docs.map(doc => {
              const d = doc.data();
              return {
                id: doc.id,
                type: 'ASSIGNMENT_PUBLISHED',
                title: d.title,
                score: null,
                max_score: d.max_points || 100,
                timestamp: d.created_at?.toDate?.() ? d.created_at.toDate().toISOString() : (d.created_at || new Date().toISOString())
              };
            });

            // Map tests to log items
            const testLogs = testsSnap.docs.map(doc => {
              const d = doc.data();
              return {
                id: doc.id,
                type: 'TEST_PUBLISHED',
                title: d.title,
                score: null,
                max_score: 100,
                timestamp: d.created_at?.toDate?.() ? d.created_at.toDate().toISOString() : (d.created_at || new Date().toISOString())
              };
            });

            logs = [...perfLogs, ...assignmentLogs, ...testLogs];

            // Sort in memory
            logs.sort((a, b) => {
              const tA = new Date(a.timestamp).getTime();
              const tB = new Date(b.timestamp).getTime();
              return tB - tA;
            });
            logs = logs.slice(0, 50);

            let attendance: any[] = [];
            const attendanceSnap = await firestore.collection('attendance')
              .where('user_id', 'in', ids)
              .get();

            const attendanceData = attendanceSnap.docs.map(doc => doc.data());
            attendance = [
              { status: 'PRESENT', count: attendanceData.filter(a => a.status === 'PRESENT').length },
              { status: 'ABSENT', count: attendanceData.filter(a => a.status === 'ABSENT').length }
            ];

            // Calculate summary stats
            let totalScore = 0;
            let totalMax = 0;
            perfLogs.forEach(log => {
              if (log.score !== null && log.score !== undefined) {
                totalScore += Number(log.score);
                totalMax += Number(log.max_score || 10);
              }
            });

            const averageScore = totalMax > 0 ? (totalScore / totalMax) * 10 : 0;
            const totalPoints = totalScore;
            const activitiesCount = perfLogs.length;
            const presentCount = attendanceData.filter(a => a.status === 'PRESENT').length;
            const totalAttendance = attendanceData.length;
            const attendanceRate = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

            stats = { 
              logs, 
              attendance,
              averageScore: parseFloat(averageScore.toFixed(1)),
              totalPoints,
              activitiesCount,
              attendanceRate: Math.round(attendanceRate)
            };
          }
        } catch (err) {
          console.error("Firestore dashboard stats error:", err);
          // Fallback to empty stats if Firestore fails
          stats = { logs: [], attendance: [] };
        }
      } else {
        const logs = db.prepare(`
          SELECT pl.*, 
                 (SELECT COUNT(*) FROM activity_likes WHERE activity_id = pl.id) as likes_count,
                 (SELECT COUNT(*) FROM activity_comments WHERE activity_id = pl.id) as comments_count,
                 EXISTS(SELECT 1 FROM activity_likes WHERE activity_id = pl.id AND user_id = ?) as is_liked,
                 EXISTS(SELECT 1 FROM activity_favorites WHERE activity_id = pl.id AND user_id = ?) as is_favorite
          FROM performance_logs pl 
          WHERE user_id = ? 
          ORDER BY timestamp DESC
        `).all(req.user.id, req.user.id, req.user.id);
        const attendance = db.prepare("SELECT status, COUNT(*) as count FROM attendance WHERE user_id = ? GROUP BY status").all(req.user.id) as any[];
        stats = { logs, attendance };
      }

      // 2. Current Class Status
      let currentLecture = null;
      if (!firestore) {
        const sched = db.prepare(`
          SELECT ts.*, c.name as class_name, ls.status
          FROM teacher_schedule ts
          JOIN classes c ON ts.class_id = c.id
          JOIN class_members cm ON c.id = cm.class_id
          LEFT JOIN lecture_status ls ON ts.id = ls.schedule_id AND date(ls.updated_at) = date('now')
          WHERE cm.user_id = ? AND ts.day_of_week = ? AND ts.start_time <= ? AND ts.end_time >= ?
        `).get(req.user.id, new Date().getDay(), 
                `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
                `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`) as any;
        currentLecture = sched;
      }

      // 3. Upcoming Tasks
      let upcomingTasks = [];
      if (firestore) {
        try {
          const uP = (req.user.program || '').trim().toUpperCase();
          const uY = (req.user.year || '').trim().toUpperCase();
          const uG = (req.user.group_name || '').trim().toUpperCase();

          const assignmentsSnap = await firestore.collection('assignments')
            .where('status', '==', 'PUBLISHED')
            .where('program', '==', uP)
            .where('year', '==', uY)
            .get();
          
          let assignments = assignmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (uG) {
            assignments = assignments.filter((a: any) => (a.group_name || '').trim().toUpperCase() === uG);
          }

          // Filter out already submitted
          const submissionsSnap = await firestore.collection('submissions')
            .where('student_id', '==', req.user.id.toString())
            .get();
          const submittedIds = new Set(submissionsSnap.docs.map(doc => doc.data().assignment_id.toString()));
          assignments = assignments.filter((a: any) => !submittedIds.has(a.id.toString()));

          const testsSnap = await firestore.collection('tests')
            .where('status', '==', 'ACTIVE')
            .where('program', '==', uP)
            .where('year', '==', uY)
            .get();
          
          let tests = testsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (uG) {
            tests = tests.filter((t: any) => (t.group_name || '').trim().toUpperCase() === uG);
          }

          // Filter out already attempted
          const attemptsSnap = await firestore.collection('test_attempts')
            .where('user_id', '==', req.user.id.toString())
            .get();
          const attemptedIds = new Set(attemptsSnap.docs.map(doc => doc.data().test_id.toString()));
          tests = tests.filter((t: any) => !attemptedIds.has(t.id.toString()));

          upcomingTasks = [
            ...assignments.map((a: any) => ({ ...a, taskType: 'ASSIGNMENT' })),
            ...tests.map((t: any) => ({ ...t, taskType: 'TEST' }))
          ].slice(0, 5);
        } catch (err) {
          console.error("Firestore upcoming tasks error:", err);
        }
      } else {
        const uP = (req.user.program || '').trim().toUpperCase();
        const uY = (req.user.year || '').trim().toUpperCase();
        const uG = (req.user.group_name || '').trim().toUpperCase();

        const assignments = db.prepare(`
          SELECT a.* FROM assignments a
          LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = ?
          WHERE a.status = 'PUBLISHED' AND s.id IS NULL
          AND TRIM(UPPER(program)) = ? AND TRIM(UPPER(year)) = ? AND TRIM(UPPER(group_name)) = ?
        `).all(req.user.id, uP, uY, uG);

        const tests = db.prepare(`
          SELECT t.* FROM tests t
          LEFT JOIN test_attempts ta ON t.id = ta.test_id AND ta.user_id = ?
          WHERE t.status = 'ACTIVE' AND ta.id IS NULL
          AND TRIM(UPPER(program)) = ? AND TRIM(UPPER(year)) = ? AND TRIM(UPPER(group_name)) = ?
        `).all(req.user.id, uP, uY, uG);
        
        upcomingTasks = [
          ...assignments.map((a: any) => ({ ...a, taskType: 'ASSIGNMENT' })),
          ...tests.map((t: any) => ({ ...t, taskType: 'TEST' }))
        ].slice(0, 5);
      }

      // 4. Notifications
      let notifications = [];
      if (firestore) {
        try {
          const notifSnap = await firestore.collection('notifications')
            .where('user_id', '==', req.user.id.toString())
            .get();
          notifications = notifSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          notifications.sort((a: any, b: any) => {
             const tA = a.created_at?.toDate?.() || new Date(a.created_at);
             const tB = b.created_at?.toDate?.() || new Date(b.created_at);
             return tB - tA;
          });
          notifications = notifications.slice(0, 10);
        } catch (err) {
          console.error("Firestore notifications dashboard error:", err);
        }
      } else {
        notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10").all(req.user.id);
      }
      
      // 5. Active Study Session
      let activeSession = null;
      if (firestore) {
        try {
          const sessionsSnap = await firestore.collection('study_sessions')
            .where('status', '==', 'ACTIVE')
            .get();
          
          // Filter by class membership
          const membersSnap = await firestore.collection('class_members')
            .where('user_id', '==', req.user.id.toString())
            .get();
          const myClassIds = new Set(membersSnap.docs.map(doc => doc.data().class_id.toString()));

          const active = sessionsSnap.docs.find(doc => myClassIds.has(doc.data().class_id.toString()));
          if (active) {
            const sessionData = active.data();
            const teacherSnap = await firestore.collection('users').doc(sessionData.teacher_id.toString()).get();
            const teacherData = teacherSnap.data();
            activeSession = {
              id: active.id,
              ...sessionData,
              teacher_name: teacherData ? `${teacherData.name} ${teacherData.surname || ''}`.trim() : 'Mësimdhënës'
            };
          }
        } catch (err) {
          console.error("Firestore active session error:", err);
        }
      } else {
        activeSession = db.prepare(`
          SELECT ss.*, u.name as teacher_name 
          FROM study_sessions ss
          JOIN users u ON ss.teacher_id = u.id
          JOIN class_members cm ON ss.class_id = cm.class_id
          WHERE cm.user_id = ? AND ss.status = 'ACTIVE'
        `).get(req.user.id);
      }

      res.json({
        stats,
        currentLecture,
        upcomingTasks,
        notifications,
        activeSession
      });

    } catch (err: any) {
      console.error("Student Dashboard Bulk Fetch Error:", err);
      res.status(500).json({ error: "Gabim në ngarkimin e dashboardit" });
    }
  });

  // Social Endpoints for Performance Logs
  app.post("/api/social-logs/:id/like", authenticate, async (req: any, res) => {
    try {
      if (firestore) {
         const likeRef = firestore.collection('performance_logs').doc(req.params.id).collection('likes').doc(req.user.id.toString());
         const doc = await likeRef.get();
         if (doc.exists) {
           await likeRef.delete();
           return res.json({ liked: false });
         } else {
           await likeRef.set({
             user_id: req.user.id.toString(),
             created_at: admin.firestore.FieldValue.serverTimestamp()
           });
           return res.json({ liked: true });
         }
      } else {
        const liked = db.prepare("SELECT 1 FROM activity_likes WHERE activity_id = ? AND user_id = ?").get(req.params.id, req.user.id);
        if (liked) {
          db.prepare("DELETE FROM activity_likes WHERE activity_id = ? AND user_id = ?").run(req.params.id, req.user.id);
          return res.json({ liked: false });
        } else {
          db.prepare("INSERT INTO activity_likes (activity_id, user_id) VALUES (?, ?)").run(req.params.id, req.user.id);
          return res.json({ liked: true });
        }
      }
    } catch (e) {
      return handleFirestoreError(res, e, "like-activity");
    }
  });

  app.post("/api/social-logs/:id/favorite", authenticate, async (req: any, res) => {
    try {
      if (firestore) {
         const favRef = firestore.collection('performance_logs').doc(req.params.id).collection('favorites').doc(req.user.id.toString());
         const doc = await favRef.get();
         if (doc.exists) {
           await favRef.delete();
           return res.json({ favorited: false });
         } else {
           await favRef.set({
             user_id: req.user.id.toString(),
             created_at: admin.firestore.FieldValue.serverTimestamp()
           });
           return res.json({ favorited: true });
         }
      } else {
        const favorited = db.prepare("SELECT 1 FROM activity_favorites WHERE activity_id = ? AND user_id = ?").get(req.params.id, req.user.id);
        if (favorited) {
          db.prepare("DELETE FROM activity_favorites WHERE activity_id = ? AND user_id = ?").run(req.params.id, req.user.id);
          return res.json({ favorited: false });
        } else {
          db.prepare("INSERT INTO activity_favorites (activity_id, user_id) VALUES (?, ?)").run(req.params.id, req.user.id);
          return res.json({ favorited: true });
        }
      }
    } catch (e) {
      return handleFirestoreError(res, e, "favorite-activity");
    }
  });

  app.post("/api/social-logs/:activityId/comments/:commentId/like", authenticate, async (req: any, res) => {
    try {
      if (firestore) {
         const likeRef = firestore.collection('performance_logs').doc(req.params.activityId).collection('comments').doc(req.params.commentId).collection('likes').doc(req.user.id.toString());
         const doc = await likeRef.get();
         if (doc.exists) {
           await likeRef.delete();
           return res.json({ liked: false });
         } else {
           await likeRef.set({
             user_id: req.user.id.toString(),
             created_at: admin.firestore.FieldValue.serverTimestamp()
           });
           return res.json({ liked: true });
         }
      } else {
        const liked = db.prepare("SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?").get(req.params.commentId, req.user.id);
        if (liked) {
          db.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?").run(req.params.commentId, req.user.id);
          return res.json({ liked: false });
        } else {
          db.prepare("INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(req.params.commentId, req.user.id);
          return res.json({ liked: true });
        }
      }
    } catch (e) {
      return handleFirestoreError(res, e, "like-comment");
    }
  });

  app.post("/api/social-logs/:id/comments", authenticate, async (req: any, res) => {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Përmbajtja është e detyrueshme" });
    }
    try {
      if (firestore) {
        const commentRef = firestore.collection('performance_logs').doc(req.params.id).collection('comments').doc();
        const comment = {
          user_id: req.user.id.toString(),
          user_name: `${req.user.name} ${req.user.surname || ''}`.trim(),
          content,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        await commentRef.set(comment);
        return res.json({ id: commentRef.id, ...comment });
      } else {
        const result = db.prepare("INSERT INTO activity_comments (activity_id, user_id, content) VALUES (?, ?, ?)").run(req.params.id, req.user.id, content);
        return res.json({ id: result.lastInsertRowid, activity_id: req.params.id, user_id: req.user.id, content });
      }
    } catch (e) {
      return handleFirestoreError(res, e, "comment-activity");
    }
  });

  app.get("/api/social-logs/:id/comments", authenticate, async (req: any, res) => {
    try {
      if (firestore) {
        const snap = await firestore.collection('performance_logs').doc(req.params.id).collection('comments').orderBy('created_at', 'desc').get();
        const comments = await Promise.all(snap.docs.map(async (doc: any) => {
          const commentId = doc.id;
          const [likesSnap, myLikeDoc] = await Promise.all([
             firestore.collection('performance_logs').doc(req.params.id).collection('comments').doc(commentId).collection('likes').get(),
             firestore.collection('performance_logs').doc(req.params.id).collection('comments').doc(commentId).collection('likes').doc(req.user.id.toString()).get()
          ]);
          return { 
            id: commentId, 
            ...doc.data(), 
            likes_count: likesSnap.size,
            is_liked: myLikeDoc.exists
          };
        }));
        return res.json(comments);
      } else {
        const comments = db.prepare(`
          SELECT ac.*, u.name as user_name,
                 (SELECT COUNT(*) FROM comment_likes WHERE comment_id = ac.id) as likes_count,
                 EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = ac.id AND user_id = ?) as is_liked
          FROM activity_comments ac
          JOIN users u ON ac.user_id = u.id
          WHERE ac.activity_id = ?
          ORDER BY ac.created_at DESC
        `).all(req.user.id, req.params.id);
        return res.json(comments);
      }
    } catch (e) {
      return handleFirestoreError(res, e, "get-activity-comments");
    }
  });

  app.get("/api/teacher/current-lecture", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    
    const now = new Date();
    const dayIndex = now.getDay(); // 0-6 (Sun-Sat)
    const dayName = ALBANIAN_DAYS[dayIndex];
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Try teacher_schedule first
    let current = db.prepare(`
      SELECT ts.*, c.name as class_name, ls.status
      FROM teacher_schedule ts
      JOIN classes c ON ts.class_id = c.id
      LEFT JOIN lecture_status ls ON ts.id = ls.schedule_id AND date(ls.updated_at) = date('now')
      WHERE ts.teacher_id = ? AND ts.day_of_week = ? AND ts.start_time <= ? AND ts.end_time >= ?
    `).get(req.user.id, dayIndex, time, time) as any;

    // If not found, try the new schedules table
    if (!current) {
      const scheduled = db.prepare(`
        SELECT s.*, c.id as class_id, c.name as class_name
        FROM schedules s
        JOIN classes c ON (s.program = c.department AND s.year = c.year AND (s.group_name = c.group_name OR s.group_name IS NULL OR c.group_name IS NULL))
        WHERE s.teacher_id = ? AND s.day_of_week = ? AND s.start_time <= ? AND s.end_time >= ?
      `).get(req.user.id, dayName, time, time) as any;

      if (scheduled) {
        // Find if it has a status
        const ls = db.prepare("SELECT status FROM lecture_status WHERE schedule_id = ? AND date(updated_at) = date('now')")
          .get(scheduled.id) as any;
          
        current = {
          ...scheduled,
          status: ls ? ls.status : null
        };
      }
    }
    
    res.json(current || null);
  });

  app.get("/api/teacher/daily-schedule", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    
    const now = new Date();
    const dayIndex = now.getDay();
    const dayName = ALBANIAN_DAYS[dayIndex];
    
    const schedules1 = db.prepare(`
      SELECT ts.*, c.name as class_name, 'LEK' as source
      FROM teacher_schedule ts
      JOIN classes c ON ts.class_id = c.id
      WHERE ts.teacher_id = ? AND ts.day_of_week = ?
    `).all(req.user.id, dayIndex) as any[];

    const schedules2 = db.prepare(`
      SELECT s.*, c.id as class_id, c.name as class_name, 'CAL' as source
      FROM schedules s
      JOIN classes c ON (s.program = c.department AND s.year = c.year AND (s.group_name = c.group_name OR s.group_name IS NULL OR c.group_name IS NULL))
      WHERE s.teacher_id = ? AND s.day_of_week = ?
    `).all(req.user.id, dayName) as any[];

    const allSchedules = [...schedules1, ...schedules2].sort((a, b) => a.start_time.localeCompare(b.start_time));
    res.json(allSchedules);
  });

  app.post("/api/teacher/lecture-status", authenticate, (req: any, res) => {
    const { scheduleId, status } = req.body;
    
    const existing = db.prepare("SELECT id FROM lecture_status WHERE schedule_id = ? AND date(updated_at) = date('now')").get(scheduleId) as any;
    
    if (existing) {
      db.prepare("UPDATE lecture_status SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, existing.id);
    } else {
      db.prepare("INSERT INTO lecture_status (schedule_id, status) VALUES (?, ?)").run(scheduleId, status);
    }

    // Broadcast update to the class
    const schedule = db.prepare(`
      SELECT ts.*, u.name as teacher_name, u.profile_photo as teacher_photo, c.name as class_name
      FROM teacher_schedule ts
      JOIN users u ON ts.teacher_id = u.id
      JOIN classes c ON ts.class_id = c.id
      WHERE ts.id = ?
    `).get(scheduleId) as any;

    if (schedule) {
      const payload = {
        ...schedule,
        status,
        updated_at: new Date().toISOString()
      };
      io.to(`class_${schedule.class_id}`).emit("lecture_status_update", payload);
      io.to(`user_${schedule.teacher_id}`).emit("lecture_status_update", payload);
    }
    
    res.json({ success: true });
  });

  app.get("/api/teacher/pending-submissions", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    
    if (firestore) {
      try {
        const assignmentsSnap = await firestore.collection('assignments').where('teacher_id', '==', req.user.id).get();
        const assignmentIds = assignmentsSnap.docs.map(doc => doc.id);
        
        const subSnap = await firestore.collection('submissions')
          .where('status', '==', 'SUBMITTED')
          .get();

        const pendingAssignments = await Promise.all(subSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(data => assignmentIds.includes(data.assignment_id.toString()))
          .map(async data => {
            const uSnap = await firestore.collection('users').doc(data.student_id.toString()).get();
            const userData = uSnap.data();
            const aSnap = await firestore.collection('assignments').doc(data.assignment_id.toString()).get();
            return {
              ...data,
              type: 'ASSIGNMENT',
              student_name: `${userData?.name || ''} ${userData?.surname || ''}`.trim(),
              title: aSnap.data()?.title,
              submitted_at: data.submitted_at
            };
          })
        );

        // Fetch tests
        const testsSnap = await firestore.collection('tests').where('teacher_id', '==', req.user.id).get();
        const testIds = testsSnap.docs.map(doc => doc.id);

        const attemptsSnap = await firestore.collection('test_attempts')
          .where('status', '==', 'SUBMITTED')
          .get();
        
        const pendingTests = await Promise.all(attemptsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(data => testIds.includes(data.test_id.toString()))
          .map(async data => {
            const uSnap = await firestore.collection('users').doc(data.user_id.toString()).get();
            const userData = uSnap.data();
            const tSnap = await firestore.collection('tests').doc(data.test_id.toString()).get();
            return {
              ...data,
              type: 'TEST',
              student_name: `${userData?.name || ''} ${userData?.surname || ''}`.trim(),
              title: tSnap.data()?.title,
              submitted_at: data.end_time || data.start_time,
              target_id: data.test_id
            };
          })
        );

        return res.json([...pendingAssignments, ...pendingTests]);
      } catch (e) {
        return handleFirestoreError(res, e, "get-pending-submissions");
      }
    }
    
    const pendingAssignments = db.prepare(`
      SELECT s.id, s.submitted_at, s.assignment_id as target_id, 'ASSIGNMENT' as type, 
             (u.name || ' ' || COALESCE(u.surname, '')) as student_name, a.title as title
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN users u ON s.student_id = u.id
      WHERE a.teacher_id = ? AND s.status = 'SUBMITTED'
    `).all(req.user.id);

    const pendingTests = db.prepare(`
      SELECT ta.id, ta.end_time as submitted_at, ta.test_id as target_id, 'TEST' as type,
             (u.name || ' ' || COALESCE(u.surname, '')) as student_name, t.title as title
      FROM test_attempts ta
      JOIN tests t ON ta.test_id = t.id
      JOIN users u ON ta.user_id = u.id
      WHERE t.teacher_id = ? AND ta.status = 'SUBMITTED'
    `).all(req.user.id);

    res.json([...pendingAssignments, ...pendingTests]);
  });

  app.get("/api/student/class-status", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const user = req.user;
        const classSnap = await firestore.collection('classes')
          .where('department', '==', user.program)
          .where('year', '==', user.year)
          .where('group_name', '==', user.group_name)
          .where('study_type', '==', user.study_type)
          .get();
        
        if (classSnap.empty) return res.json(null);
        const classroom = classSnap.docs[0].data();

        const now = new Date();
        const day = now.getDay();
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const lectureSnap = await firestore.collection('teacher_schedule')
          .where('class_id', '==', classroom.id)
          .where('day_of_week', '==', day.toString())
          .get();
        
        const lectures = lectureSnap.docs.map(doc => doc.data());
        const lecture = lectures.find(l => l.start_time <= time && l.end_time >= time);

        if (!lecture) return res.json(null);

        // Get teacher name
        const teacherSnap = await firestore.collection('users').doc(lecture.teacher_id).get();
        const teacher = teacherSnap.data();

        // Get status
        const statusSnap = await firestore.collection('lecture_status')
          .where('schedule_id', '==', lecture.id)
          .get();
        
        const status = statusSnap.empty ? null : statusSnap.docs[0].data();

        return res.json({
          ...lecture,
          teacher_name: teacher ? `${teacher.name} ${teacher.surname}` : 'I panjohur',
          status: status?.status
        });
      } catch (e) {
        return handleFirestoreError(res, e, "get-class-status");
      }
    }

    const user = db.prepare("SELECT program, year, group_name, study_type FROM users WHERE id = ?").get(req.user.id) as any;
    if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });
    const classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
      .get(user.program, user.year, user.group_name, user.study_type) as any;
    
    if (!classroom) return res.json(null);

    const now = new Date();
    const day = now.getDay();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const lecture = db.prepare(`
      SELECT ts.*, (u.name || ' ' || COALESCE(u.surname, '')) as teacher_name, ls.status
      FROM teacher_schedule ts
      JOIN users u ON ts.teacher_id = u.id
      LEFT JOIN lecture_status ls ON ts.id = ls.schedule_id AND date(ls.updated_at) = date('now')
      WHERE ts.class_id = ? AND ts.day_of_week = ? AND ts.start_time <= ? AND ts.end_time >= ?
    `).get(classroom.id, day, time, time) as any;

    res.json(lecture || null);
  });
  app.post("/api/user/profile", authenticate, async (req: any, res) => {
    const { name, surname, phone, bio, group_name, study_type } = req.body;
    if (firestore) {
      try {
        const userRef = firestore.collection('users').doc(req.user.id.toString());
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          await userRef.update({
            name, surname, phone, bio, group_name, study_type
          });
          const updatedUser = (await userRef.get()).data();
          if (updatedUser) delete updatedUser.password;
          return res.json(updatedUser);
        }
      } catch (e) {
        console.error("Firestore Profile Update Error:", e);
      }
    }
    try {
      db.prepare(`
        UPDATE users 
        SET name = ?, surname = ?, phone = ?, bio = ?, group_name = ?, study_type = ? 
        WHERE id = ?
      `).run(name, surname, phone, bio, group_name, study_type, req.user.id);
      
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id) as any;
      if (user) delete user.password;
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: "Gabim gjatë përditësimit të profilit" });
    }
  });

  app.post("/api/user/verify-email", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        await firestore.collection('users').doc(req.user.id.toString()).update({ email_verified: 1 });
        return res.json({ success: true, message: "Emaili u verifikua me sukses!" });
      } catch (e) {
        return handleFirestoreError(res, e, "verify-email");
      }
    }
    try {
      db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(req.user.id);
      res.json({ success: true, message: "Emaili u verifikua me sukses!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/users/:id", authenticate, async (req: any, res) => {
    const { id } = req.params;
    try {
      const user = db.prepare("SELECT id, name, surname, email, role, profile_photo, phone, email_verified FROM users WHERE id = ?").get(id);
      if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: "Gabim gjatë marrjes së të dhënave" });
    }
  });

  app.get("/api/classes/my", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        if (req.user.role === 'STUDENT') {
          const memberSnap = await firestore.collection('class_members')
            .where('user_id', '==', req.user.id)
            .where('status', '==', 'CONFIRMED')
            .get();
          
          const classIds = memberSnap.docs.map(doc => doc.data().class_id);
          if (classIds.length === 0) return res.json([]);
          
          const classes: any[] = [];
          for (const id of classIds) {
            const classDoc = await firestore.collection('classes').doc(id).get();
            if (classDoc.exists) classes.push({ id: classDoc.id, ...classDoc.data() });
          }
          return res.json(classes);
        } else {
          // Teacher
          const scheduleSnap = await firestore.collection('teacher_schedule')
            .where('teacher_id', '==', req.user.id)
            .get();
          
          const classIds = Array.from(new Set(scheduleSnap.docs.map(doc => doc.data().class_id)));
          if (classIds.length === 0) return res.json([]);
          
          const classes: any[] = [];
          for (const id of classIds) {
            const classDoc = await firestore.collection('classes').doc(id).get();
            if (classDoc.exists) classes.push({ id: classDoc.id, ...classDoc.data() });
          }
          return res.json(classes);
        }
      } catch (err) {
        return handleFirestoreError(res, err, "get-my-classes");
      }
    }
    
    try {
      if (req.user.role === 'STUDENT') {
        const classes = db.prepare(`
          SELECT c.* 
          FROM classes c
          JOIN class_members cm ON c.id = cm.class_id
          WHERE cm.user_id = ? AND cm.status = 'CONFIRMED'
        `).all(req.user.id);
        res.json(classes);
      } else {
        const classes = db.prepare(`
          SELECT DISTINCT c.* 
          FROM classes c
          JOIN teacher_schedule ts ON c.id = ts.class_id
          WHERE ts.teacher_id = ?
        `).all(req.user.id);
        res.json(classes);
      }
    } catch (err) {
      res.status(500).json({ error: "Gabim gjatë marrjes së klasave" });
    }
  });

  app.get("/api/classes", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        if (req.user.role === 'TEACHER') {
          // Match logic from dashboard for consistency
          const [classesSnap, allTeacherSchedsSnap, allSchedulesSnap] = await Promise.all([
            firestore.collection('classes').where('teacher_id', '==', req.user.id.toString()).get(),
            firestore.collection('teacher_schedule').where('teacher_id', '==', req.user.id.toString()).get(),
            firestore.collection('schedules').where('teacher_id', '==', req.user.id.toString()).get()
          ]);

          const directClasses = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const teacherScheds = allTeacherSchedsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const allSchedules = allSchedulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const allRelevantSchedules = [...teacherScheds, ...allSchedules];
          const scheduledClassIds = [...new Set(allRelevantSchedules.map((s: any) => s.class_id?.toString()).filter(Boolean))];
          
          const missingClassIds = scheduledClassIds.filter(id => !directClasses.some(c => c.id.toString() === id));
          let additionalClasses: any[] = [];
          if (missingClassIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < missingClassIds.length; i += 10) {
              chunks.push(missingClassIds.slice(i, i + 10));
            }
            const extraSnaps = await Promise.all(chunks.map(chunk => 
              firestore.collection('classes').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get()
            ));
            extraSnaps.forEach(snap => {
              snap.docs.forEach(doc => additionalClasses.push({ id: doc.id, ...doc.data() }));
            });
          }
          
          let combinedClasses = [...directClasses, ...additionalClasses];
          allRelevantSchedules.forEach((s: any) => {
            const hasClass = combinedClasses.some(c => c.id.toString() === (s.class_id?.toString() || `VIRT_${s.id}`));
            if (!hasClass && !s.class_id) {
               combinedClasses.push({
                 id: `VIRT_${s.id}`,
                 name: `${s.subject || s.program} - ${s.year} ${s.group_name || ''}`.trim(),
                 department: s.program,
                 year: s.year,
                 group_name: s.group_name,
                 virtual: true,
                 subject: s.subject
               });
            }
          });
          return res.json(combinedClasses);
        }
        const classSnap = await firestore.collection('classes').get();
        return res.json(classSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        return handleFirestoreError(res, err, "get-classes");
      }
    }
    try {
      let classes;
      if (req.user.role === 'TEACHER') {
        // Return classes that either have this teacher assigned or appear in their schedules
        classes = db.prepare(`
          SELECT DISTINCT c.* 
          FROM classes c
          LEFT JOIN schedules s ON (c.department = s.program AND c.year = s.year AND (c.group_name = s.group_name OR s.group_name IS NULL))
          LEFT JOIN teacher_schedule ts ON c.id = ts.class_id
          WHERE c.teacher_id = ? OR s.teacher_id = ? OR ts.teacher_id = ?
        `).all(req.user.id, req.user.id, req.user.id);
      } else {
        classes = db.prepare("SELECT * FROM classes").all();
      }
      res.json(classes);
    } catch (err) {
      console.error("Fetch classes error:", err);
      res.status(500).json({ error: "Gabim gjatë marrjes së klasave" });
    }
  });

  app.get("/api/class/members", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const userSnap = await firestore.collection('users').doc(req.user.id.toString()).get();
        if (userSnap.exists) {
          const user = userSnap.data();
          if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

          // Ensure we have all required fields for the query
          if (!user.program || !user.year || !user.group_name || !user.study_type) {
            console.warn("User missing class fields for members query:", req.user.id);
            return res.json([]);
          }

          const membersSnap = await firestore.collection('users')
            .where('program', '==', user.program)
            .where('year', '==', user.year)
            .where('group_name', '==', user.group_name)
            .where('study_type', '==', user.study_type)
            .get();

          const members = membersSnap.docs.map(doc => {
            const data = doc.data();
            return {
              id: data.id,
              name: data.name,
              surname: data.surname,
              role: data.role,
              profile_photo: data.profile_photo,
              is_confirmed: data.is_confirmed
            };
          });

          const onlineUserIds = new Set(Array.from(onlineUsers.values()).map((u: any) => u.id));
          const membersWithStatus = members.map(m => ({
            ...m,
            isOnline: onlineUserIds.has(m.id)
          }));

          return res.json(membersWithStatus);
        }
      } catch (err) {
        return handleFirestoreError(res, err, "get-class-members");
      }
    }
    try {
      const user = db.prepare("SELECT program, year, group_name, study_type FROM users WHERE id = ?").get(req.user.id) as any;
      if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

      const members = db.prepare(`
        SELECT id, name, surname, role, profile_photo, email, phone, email_verified, is_confirmed
        FROM users 
        WHERE program = ? AND year = ? AND group_name = ? AND study_type = ?
      `).all(user.program, user.year, user.group_name, user.study_type) as any[];

      // Add online status
      const onlineUserIds = new Set(Array.from(onlineUsers.values()).map((u: any) => u.id));
      const membersWithStatus = members.map(m => ({
        ...m,
        isOnline: onlineUserIds.has(m.id)
      }));

      res.json(membersWithStatus);
    } catch (err) {
      res.status(500).json({ error: "Gabim gjatë marrjes së anëtarëve të klasës" });
    }
  });

  app.get("/api/user/me", authenticate, async (req: any, res) => {
    // If we're here, authenticate has already found the user and put them in req.user
    // We just need to ensure we return the latest class status and info
    
    if (firestore) {
      try {
        const user = req.user;
        const memberSnap = await firestore.collection('class_members').where('user_id', '==', user.id).get();
        const member = memberSnap.empty ? null : memberSnap.docs[0].data();

        return res.json({
          ...user,
          class_status: member?.status || user.class_status,
          is_class_admin: member?.is_admin || user.is_class_admin
        });
      } catch (e) {
        console.error("Error in /api/user/me (Firestore):", e);
        // Fallback to req.user if firestore fails
        return res.json(req.user);
      }
    }

    // SQLite branch
    try {
      const user = db.prepare(`
        SELECT u.id, u.name, u.surname, u.email, u.role, u.class_code, u.program, u.year, u.group_name, u.study_type, u.phone, u.bio, u.profile_photo, u.is_confirmed, u.email_verified,
               cm.status as class_status, cm.is_admin as is_class_admin
        FROM users u
        LEFT JOIN class_members cm ON u.id = cm.user_id
        WHERE u.id = ?
      `).get(req.user.id) as any;
      
      if (!user) return res.json(req.user); // Last resort fallback
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: "Gabim gjatë marrjes së të dhënave të përdoruesit" });
    }
  });

  app.post("/api/user/profile-photo", authenticate, upload.single('photo'), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "Nuk u ngarkua asnjë foto" });
    const photoPath = `/uploads/${req.file.filename}`;
    if (firestore) {
      try {
        await firestore.collection('users').doc(req.user.id.toString()).update({ profile_photo: photoPath });
        return res.json({ photoPath });
      } catch (e) {
        return handleFirestoreError(res, e, "update-profile-photo");
      }
    }
    db.prepare("UPDATE users SET profile_photo = ? WHERE id = ?").run(photoPath, req.user.id);
    res.json({ photoPath });
  });

  app.post("/api/classes/:id/note", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { note } = req.body;
    
    if (firestore) {
      try {
        await firestore.collection('classes').doc(req.params.id).update({
          pinned_note: note,
          note_updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        return handleFirestoreError(res, e, "update-class-note");
      }
    } else {
      db.prepare("UPDATE classes SET pinned_note = ?, note_updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(note, req.params.id);
    }
    
    io.to(`class_${req.params.id}`).emit("class_note_update", { classId: req.params.id, note });
    res.json({ success: true, note });
  });

  app.post("/api/classes/:id/end-lecture", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    
    // In Firestore we might want to store the session status, but for now we just broadcast
    io.to(`class_${req.params.id}`).emit("lecture_ended", { 
      message: "Mësimi mbaroi, faleminderit për prezencën tuaj!" 
    });
    res.json({ success: true });
  });

  app.get("/api/student/active-notes", authenticate, async (req: any, res) => {
    if (req.user.role !== 'STUDENT') return res.json([]);
    
    if (firestore) {
      try {
        // First get classes the student is in
        const membersSnap = await firestore.collection('class_members')
          .where('user_id', '==', req.user.id.toString())
          .where('status', '==', 'CONFIRMED')
          .get();
        
        const classIds = membersSnap.docs.map(doc => doc.data().class_id);
        if (classIds.length === 0) return res.json([]);

        // Get those classes
        const classesSnap = await firestore.collection('classes')
          .where(admin.firestore.FieldPath.documentId(), 'in', classIds.slice(0, 30))
          .get();
        
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        
        const results: any[] = [];

        for (const doc of classesSnap.docs) {
          const classData = doc.data();
          if (!classData.teacher_id) continue;

          const teacherSnap = await firestore.collection('users').doc(classData.teacher_id.toString()).get();
          const teacherData = teacherSnap.data();
          const teacherName = `${teacherData?.name || ''} ${teacherData?.surname || ''}`.trim();

          // Check pinned note (24h)
          if (classData.pinned_note && classData.note_updated_at) {
            const updatedAt = classData.note_updated_at?.toDate?.() || new Date(classData.note_updated_at);
            if (updatedAt > oneDayAgo) {
              results.push({
                class_id: doc.id,
                class_name: classData.name,
                pinned_note: classData.pinned_note,
                note_updated_at: updatedAt,
                teacher_name: teacherName,
                teacher_photo: teacherData?.profile_photo,
                type: 'END_NOTE'
              });
            }
          }

          // Check opening comment (6h)
          if (classData.opening_comment && classData.opening_comment_at) {
            const updatedAt = classData.opening_comment_at?.toDate?.() || new Date(classData.opening_comment_at);
            if (updatedAt > sixHoursAgo) {
              results.push({
                class_id: doc.id + "_start",
                class_name: classData.name,
                pinned_note: classData.opening_comment,
                note_updated_at: updatedAt,
                teacher_name: teacherName,
                teacher_photo: teacherData?.profile_photo,
                type: 'START_COMMENT'
              });
            }
          }
        }

        return res.json(results);
      } catch (err) {
        return handleFirestoreError(res, err, "get-active-notes-dashboard");
      }
    }

    try {
      const pinnedNotes = db.prepare(`
        SELECT c.id as class_id, c.name as class_name, c.pinned_note, c.note_updated_at,
               (u.name || ' ' || u.surname) as teacher_name, u.profile_photo as teacher_photo, 'END_NOTE' as type
        FROM classes c
        JOIN class_members cm ON c.id = cm.class_id
        JOIN users u ON c.teacher_id = u.id
        WHERE cm.user_id = ? AND cm.status = 'CONFIRMED'
        AND c.pinned_note IS NOT NULL AND c.pinned_note != ''
        AND c.note_updated_at > datetime('now', '-1 day')
      `).all(req.user.id);

      const openingComments = db.prepare(`
        SELECT (c.id || '_start') as class_id, c.name as class_name, c.opening_comment as pinned_note, c.opening_comment_at as note_updated_at,
               (u.name || ' ' || u.surname) as teacher_name, u.profile_photo as teacher_photo, 'START_COMMENT' as type
        FROM classes c
        JOIN class_members cm ON c.id = cm.class_id
        JOIN users u ON c.teacher_id = u.id
        WHERE cm.user_id = ? AND cm.status = 'CONFIRMED'
        AND c.opening_comment IS NOT NULL AND c.opening_comment != ''
        AND c.opening_comment_at > datetime('now', '-6 hours')
      `).all(req.user.id);

      const allNotes = [...pinnedNotes, ...openingComments].sort((a: any, b: any) => 
        new Date(b.note_updated_at).getTime() - new Date(a.note_updated_at).getTime()
      );

      res.json(allNotes);
    } catch (err) {
      res.status(500).json({ error: "Gabim në marrjen e shënimeve" });
    }
  });

  // --- Personal Notes API ---
  app.get("/api/personal-notes", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        // Simplified query to avoid immediate index requirement, sorting in memory
        const snap = await firestore.collection('personal_notes')
          .where('user_id', '==', req.user.id.toString())
          .get();
        
        const notes = snap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          // Ensure we have JS dates for sorting
          updated_at: doc.data().updated_at?.toDate() || new Date()
        }));

        // Sort: is_pinned (desc), then updated_at (desc)
        notes.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
          return b.updated_at.getTime() - a.updated_at.getTime();
        });

        return res.json(notes);
      } catch (e) {
        return handleFirestoreError(res, e, "get-personal-notes");
      }
    }
    
    const notes = db.prepare("SELECT * FROM personal_notes WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC").all(req.user.id);
    res.json(notes);
  });

  app.post("/api/personal-notes", authenticate, async (req: any, res) => {
    const { title, content, color, is_pinned } = req.body;
    if (firestore) {
      try {
        const docRef = await firestore.collection('personal_notes').add({
          user_id: req.user.id.toString(),
          title: title || '',
          content: content || '',
          color: color || '#ffffff',
          is_pinned: !!is_pinned,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ id: docRef.id, success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "create-personal-note");
      }
    }
    
    const result = db.prepare("INSERT INTO personal_notes (user_id, title, content, color, is_pinned) VALUES (?, ?, ?, ?, ?)")
      .run(req.user.id, title || '', content || '', color || '#ffffff', is_pinned ? 1 : 0);
    res.json({ id: result.lastInsertRowid, success: true });
  });

  app.put("/api/personal-notes/:id", authenticate, async (req: any, res) => {
    const { title, content, color, is_pinned } = req.body;
    if (firestore) {
      try {
        await firestore.collection('personal_notes').doc(req.params.id).update({
          title, content, color, is_pinned,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "update-personal-note");
      }
    }
    
    db.prepare("UPDATE personal_notes SET title = ?, content = ?, color = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?")
      .run(title, content, color, is_pinned ? 1 : 0, req.params.id, req.user.id);
    res.json({ success: true });
  });

  app.delete("/api/personal-notes/:id", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        await firestore.collection('personal_notes').doc(req.params.id).delete();
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "delete-personal-note");
      }
    }
    
    db.prepare("DELETE FROM personal_notes WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  // Study Sessions
  const activeTimeouts = new Map<number, NodeJS.Timeout>();

  app.post("/api/study/start", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { classId, subject, comment } = req.body;
    if (!classId) return res.status(400).json({ error: "Klasa është e detyrueshme" });
    let { duration } = req.body;

    // Strict School Hour Logic
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    if (hour >= 8 && hour < 18) {
      if (minute < 50) {
        duration = 50 - minute;
      } else {
        // Break time (X:50 to X:00)
        return res.status(400).json({ error: "Nuk mund të filloni mësimin gjatë pushimit (pas minutës së 50-të)." });
      }
    } else {
      // Fallback for sessions outside 8-18 (if needed, or just default to 50)
      duration = duration || 50;
    }
    
    if (firestore) {
      try {
        // Close previous sessions
        const prevSessions = await firestore.collection('study_sessions')
          .where('teacher_id', '==', req.user.id)
          .where('status', '==', 'ACTIVE')
          .get();
        
        const batch = firestore.batch();
        prevSessions.forEach(doc => batch.update(doc.ref, { status: 'COMPLETED' }));
        
        const sessionRef = firestore.collection('study_sessions').doc();
        const sessionId = sessionRef.id;
        batch.set(sessionRef, {
          id: sessionId,
          teacher_id: req.user.id,
          class_id: classId,
          subject,
          duration,
          status: 'ACTIVE',
          start_comment: comment,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        if (comment) {
          batch.update(firestore.collection('classes').doc(classId.toString()), {
            opening_comment: comment,
            opening_comment_at: admin.firestore.FieldValue.serverTimestamp()
          });

          // Send notifications to all students in class
          const membersSnap = await firestore.collection('class_members')
            .where('class_id', '==', classId.toString())
            .where('status', '==', 'CONFIRMED')
            .get();
          
          membersSnap.docs.forEach(doc => {
            const member = doc.data();
            const notifRef = firestore.collection('notifications').doc();
            batch.set(notifRef, {
              user_id: member.user_id,
              title: `Shënim nga Ora e Mësimit: ${subject}`,
              content: comment,
              type: 'MESSAGE',
              created_at: admin.firestore.FieldValue.serverTimestamp()
            });
          });
        }
        
        await batch.commit();
        io.to(`class_${classId}`).emit("study_session_start", { sessionId, classId, subject, duration, teacherName: req.user.name });
        
        // Timeout logic (limited on serverless)
        setTimeout(async () => {
          try {
            await firestore.collection('study_sessions').doc(sessionId).update({ status: 'COMPLETED' });
            io.to(`class_${classId}`).emit("study_session_end", { sessionId, auto: true });
          } catch (e) {}
        }, duration * 60 * 1000);

        return res.json({ sessionId });
      } catch (e) {
        return handleFirestoreError(res, e, "start-study-session");
      }
    }

    // Close any previous active sessions for this teacher
    db.prepare("UPDATE study_sessions SET status = 'COMPLETED' WHERE teacher_id = ? AND status = 'ACTIVE'").run(req.user.id);
    
    const info = db.prepare("INSERT INTO study_sessions (teacher_id, class_id, subject, duration) VALUES (?, ?, ?, ?)").run(req.user.id, classId, subject, duration);
    const sessionId = info.lastInsertRowid as number;

    if (comment) {
      db.prepare("UPDATE classes SET opening_comment = ?, opening_comment_at = CURRENT_TIMESTAMP WHERE id = ?").run(comment, classId);
      
      const students = db.prepare("SELECT user_id FROM class_members WHERE class_id = ? AND status = 'CONFIRMED'").all(classId) as any[];
      const insertNotif = db.prepare("INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, 'MESSAGE')");
      
      db.transaction(() => {
        for (const s of students) {
          insertNotif.run(s.user_id, `Shënim nga Ora e Mësimit: ${subject}`, comment);
        }
      })();
    }
    
    io.to(`class_${classId}`).emit("study_session_start", { sessionId, classId, subject, duration, teacherName: req.user.name });
    
    // Set timeouts for notifications and auto-close
    if (duration > 5) {
      const warningTime = (duration - 5) * 60 * 1000;
      const warningTimeout = setTimeout(() => {
        io.to(`class_${classId}`).emit("study_session_warning", { sessionId, message: "Ora po përfundon në 5 minuta" });
      }, warningTime);
      activeTimeouts.set(sessionId * 10 + 1, warningTimeout);
    }
    
    const closeTimeout = setTimeout(() => {
      db.prepare("UPDATE study_sessions SET status = 'COMPLETED' WHERE id = ?").run(sessionId);
      io.to(`class_${classId}`).emit("study_session_end", { sessionId, auto: true });
    }, duration * 60 * 1000);
    activeTimeouts.set(sessionId * 10 + 2, closeTimeout);

    res.json({ sessionId });
  });

  app.post("/api/classes/:id/publish-comment", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { comment } = req.body;
    const classId = req.params.id;

    if (!comment) return res.status(400).json({ error: "Komenti është i detyrueshëm" });

    if (firestore) {
      try {
        const batch = firestore.batch();
        
        batch.update(firestore.collection('classes').doc(classId.toString()), {
          opening_comment: comment,
          opening_comment_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Send notifications to all students in class
        const membersSnap = await firestore.collection('class_members')
          .where('class_id', '==', classId.toString())
          .where('status', '==', 'CONFIRMED')
          .get();
        
        membersSnap.docs.forEach(doc => {
          const member = doc.data();
          const notifRef = firestore.collection('notifications').doc();
          batch.set(notifRef, {
            user_id: member.user_id,
            title: `Njoftim i Ri nga Pedagogu`,
            content: comment,
            type: 'MESSAGE',
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        });

        await batch.commit();
        io.to(`class_${classId}`).emit("class_announcement", { classId, comment, teacherName: req.user.name });
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "publish-class-comment");
      }
    }

    db.prepare("UPDATE classes SET opening_comment = ?, opening_comment_at = CURRENT_TIMESTAMP WHERE id = ?").run(comment, classId);
    
    const students = db.prepare("SELECT user_id FROM class_members WHERE class_id = ? AND status = 'CONFIRMED'").all(classId) as any[];
    const insertNotif = db.prepare("INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, 'MESSAGE')");
    
    db.transaction(() => {
      for (const s of students) {
        insertNotif.run(s.user_id, `Njoftim i Ri nga Pedagogu`, comment);
      }
    })();

    io.to(`class_${classId}`).emit("class_announcement", { classId, comment, teacherName: req.user.name });
    res.json({ success: true });
  });

  app.post("/api/study/end", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { sessionId, note } = req.body;
    
    if (!sessionId) return res.status(400).json({ error: "Session ID është i detyrueshëm" });

    if (firestore) {
      try {
        const doc = await firestore.collection('study_sessions').doc(sessionId.toString()).get();
        const session = doc.data();
        await firestore.collection('study_sessions').doc(sessionId.toString()).update({ status: 'COMPLETED' });
        
        if (session && note) {
          await firestore.collection('classes').doc(session.class_id.toString()).update({
            pinned_note: note,
            note_updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        if (session) {
          io.to(`class_${session.class_id}`).emit("study_session_end", { sessionId, auto: false });
        } else {
          io.emit("study_session_end", { sessionId, auto: false });
        }
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "end-study-session");
      }
    }

    const session = db.prepare("SELECT class_id FROM study_sessions WHERE id = ?").get(sessionId) as any;
    if (session && note) {
      db.prepare("UPDATE classes SET pinned_note = ?, note_updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(note, session.class_id);
    }
    db.prepare("UPDATE study_sessions SET status = 'COMPLETED' WHERE id = ?").run(sessionId);
    
    // Clear timeouts
    const t1 = activeTimeouts.get(sessionId * 10 + 1);
    const t2 = activeTimeouts.get(sessionId * 10 + 2);
    if (t1) clearTimeout(t1);
    if (t2) clearTimeout(t2);
    activeTimeouts.delete(sessionId * 10 + 1);
    activeTimeouts.delete(sessionId * 10 + 2);
    
    if (session) {
      io.to(`class_${session.class_id}`).emit("study_session_end", { sessionId, auto: false });
    } else {
      io.emit("study_session_end", { sessionId, auto: false });
    }
    res.json({ success: true });
  });

  app.get("/api/student/daily-presence", authenticate, async (req: any, res) => {
    if (req.user.role !== 'STUDENT') return res.json([]);
    
    const now = new Date();
    // Use Hour 17 (5 PM) as limit
    if (now.getHours() >= 17) return res.json([]);

    const todayStr = now.toISOString().split('T')[0];

    if (firestore) {
      try {
        const presenceSnap = await firestore.collection('session_presence')
          .where('user_id', '==', req.user.id.toString())
          .get();
        
        const presence = await Promise.all(presenceSnap.docs.map(async d => {
          const pData = d.data();
          const session_id_str = pData.session_id?.toString();
          const sessionSnap = session_id_str ? await firestore.collection('study_sessions').doc(session_id_str).get() : null;
          const sessionData = sessionSnap?.data();
          const teacher_id_str = sessionData?.teacher_id?.toString();
          const teacherSnap = teacher_id_str ? await firestore.collection('users').doc(teacher_id_str).get() : null;
          const teacherData = teacherSnap?.data();
          
          const createdAt = sessionData?.created_at?.toDate?.() || new Date(sessionData?.created_at);
          if (createdAt.toISOString().split('T')[0] === todayStr) {
            return {
              subject: sessionData?.subject,
              teacher_name: `${teacherData?.name || ''} ${teacherData?.surname || ''}`.trim(),
              program: teacherData?.program || req.user.program
            };
          }
          return null;
        }));
        
        return res.json(presence.filter(p => p !== null));
      } catch (e) {
        return handleFirestoreError(res, e, "get-daily-presence");
      }
    }

    const presence = db.prepare(`
      SELECT s.subject, u.name as t_name, u.surname as t_surname, u.program as t_program
      FROM session_presence sp
      JOIN study_sessions s ON sp.session_id = s.id
      JOIN users u ON s.teacher_id = u.id
      WHERE sp.user_id = ? AND date(s.created_at) = date('now')
    `).all(req.user.id) as any[];

    res.json(presence.map(p => ({
      subject: p.subject,
      teacher_name: `${p.t_name} ${p.t_surname || ''}`.trim(),
      program: p.t_program || req.user.program
    })));
  });

  app.get("/api/student/history", authenticate, async (req: any, res) => {
    if (req.user.role !== 'STUDENT') return res.status(403).json({ error: "Pa autorizuar" });
    
    if (firestore) {
      try {
        const ids = [req.user.id.toString(), parseInt(req.user.id)].filter(v => typeof v !== 'undefined' && v !== null && !isNaN(v as any));
        
        let presence: any[] = [];
        if (ids.length > 0) {
          const presenceSnap = await firestore.collection('session_presence')
            .where('user_id', 'in', ids)
            .get();
          
          presence = await Promise.all(presenceSnap.docs.map(async d => {
            const pData = d.data();
            const sessionSnap = await firestore.collection('study_sessions').doc(pData.session_id.toString()).get();
            const sessionData = sessionSnap.data();
            const teacherSnap = sessionData ? await firestore.collection('users').doc(sessionData.teacher_id.toString()).get() : null;
            const teacherData = teacherSnap?.data();
            
            return {
              subject: sessionData?.subject,
              t_name: teacherData?.name,
              t_surname: teacherData?.surname,
              is_verified: pData.is_verified,
              created_at: sessionData?.created_at?.toDate?.() || sessionData?.created_at
            };
          }));
        }

        let testResults: any[] = [];
        if (ids.length > 0) {
          const testSnap = await firestore.collection('test_attempts')
            .where('user_id', 'in', ids)
            .where('status', '==', 'GRADED')
            .get();
          
          testResults = await Promise.all(testSnap.docs.map(async d => {
            const ta = d.data();
            const testSnap = await firestore.collection('tests').doc(ta.test_id.toString()).get();
            const test = testSnap.data();
            return {
              title: test?.title,
              total_score: ta.total_score,
              max_score: test?.total_points,
              grade: ta.grade,
              date: ta.end_time?.toDate?.() || ta.end_time
            };
          }));
        }

        const subSnap = await firestore.collection('submissions')
          .where('student_id', '==', req.user.id.toString())
          .where('status', '==', 'GRADED')
          .get();
        
        const homeworkResults = await Promise.all(subSnap.docs.map(async d => {
          const s = d.data();
          const asSnap = await firestore.collection('assignments').doc(s.assignment_id.toString()).get();
          const as = asSnap.data();
          return {
            title: as?.title,
            points: s.points,
            max_points: as?.max_points,
            grade: s.grade,
            date: s.graded_at?.toDate?.() || s.graded_at
          };
        }));

        return res.json({ 
          presence: presence.filter(p => p.subject).sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), 
          testResults: testResults.sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
          homeworkResults: homeworkResults.sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()) 
        });
      } catch (err) {
        console.error("Firestore history error:", err);
      }
    }

    // SQLite fallback...
    const presence = db.prepare(`
      SELECT s.subject, u.name as t_name, u.surname as t_surname, s.created_at, sp.is_verified
      FROM session_presence sp
      JOIN study_sessions s ON sp.session_id = s.id
      JOIN users u ON s.teacher_id = u.id
      WHERE sp.user_id = ?
      ORDER BY s.created_at DESC
    `).all(req.user.id) as any[];

    res.json({
      presence: presence.map(p => ({
        subject: p.subject,
        t_name: p.t_name,
        t_surname: p.t_surname,
        is_verified: p.is_verified,
        created_at: p.created_at
      })),
      testResults: db.prepare(`
        SELECT t.title, ta.total_score, t.total_points as max_score, ta.grade, ta.end_time as date
        FROM test_attempts ta
        JOIN tests t ON ta.test_id = t.id
        WHERE ta.user_id = ? AND ta.status = 'GRADED'
        ORDER BY ta.end_time DESC
      `).all(req.user.id),
      homeworkResults: db.prepare(`
        SELECT a.title, s.points, a.max_points, s.grade, s.graded_at as date
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE s.student_id = ? AND s.status = 'GRADED'
        ORDER BY s.graded_at DESC
      `).all(req.user.id)
    });
  });

  app.post("/api/user/mark-verified-shown", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        await firestore.collection('users').doc(req.user.id.toString()).update({ email_verified_shown: 1 });
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "mark-verified-shown");
      }
    }
    db.prepare("UPDATE users SET email_verified_shown = 1 WHERE id = ?").run(req.user.id);
    res.json({ success: true });
  });

  // Activities & University Events
  app.get("/api/activities", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const activitiesSnap = await firestore.collection('activities').orderBy('created_at', 'desc').get();
        const activities = await Promise.all(activitiesSnap.docs.map(async doc => {
          const data = { id: doc.id, ...doc.data() } as any;
          const userDoc = await firestore.collection('users').doc(data.user_id.toString()).get();
          const userData = userDoc.data();
          
          // Get votes
          const votesSnap = await firestore.collection('activities').doc(doc.id).collection('votes').get();
          const votes: any = {};
          votesSnap.forEach(v => {
            votes[v.id] = v.data().option_index;
          });

          return {
            ...data,
            user_name: userData ? `${userData.name} ${userData.surname || ''}` : 'Përdorues i panjohur',
            user_role: userData ? userData.role : 'STUDENT',
            user_photo: userData ? userData.profile_photo : null,
            is_president: userData ? userData.is_president : false,
            votes
          };
        }));
        return res.json(activities);
      } catch (err) {
        return handleFirestoreError(res, err, "get-activities");
      }
    }
    
    try {
      const activities = db.prepare(`
        SELECT a.*, u.name as user_name, u.surname as user_surname, u.role as user_role, u.profile_photo as user_photo
        FROM activities a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
      `).all() as any[];

      const activitiesWithVotes = activities.map(a => {
        const votesRaw = db.prepare("SELECT user_id, option_index FROM activity_votes WHERE activity_id = ?").all(a.id) as any[];
        const votes: any = {};
        votesRaw.forEach(v => {
          votes[v.user_id] = v.option_index;
        });
        return {
          ...a,
          user_name: `${a.user_name} ${a.user_surname || ''}`,
          poll_options: a.poll_options ? JSON.parse(a.poll_options) : null,
          votes
        };
      });
      res.json(activitiesWithVotes);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Dështoi marrja e aktiviteteve" });
    }
  });

  app.post("/api/activities", authenticate, async (req: any, res) => {
    const { title, description, type, link_url, file_url, poll_options, item_type } = req.body;
    
    if (!title || !description || !type) {
      return res.status(400).json({ error: "Të gjitha fushat janë të detyrueshme" });
    }

    const activityData = {
      user_id: req.user.id.toString(),
      title: filterProfanity(title),
      description: filterProfanity(description),
      type,
      link_url: link_url || null,
      file_url: file_url || null,
      poll_options: poll_options ? (Array.isArray(poll_options) ? poll_options : JSON.parse(poll_options)) : null,
      item_type: item_type || null,
      status: 'OPEN',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    if (firestore) {
      try {
        const docRef = await firestore.collection('activities').add(activityData);
        return res.json({ id: docRef.id, ...activityData });
      } catch (err) {
        return handleFirestoreError(res, err, "create-activity");
      }
    }

    try {
      const info = db.prepare(`
        INSERT INTO activities (user_id, title, description, type, link_url, file_url, poll_options, item_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id, title, description, type, link_url || null, file_url || null, 
        poll_options ? (typeof poll_options === 'string' ? poll_options : JSON.stringify(poll_options)) : null,
        item_type || null
      );
      res.json({ id: info.lastInsertRowid, ...activityData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Dështoi krijimi i aktivitetit" });
    }
  });

  app.post("/api/activities/:id/vote", authenticate, async (req: any, res) => {
    const { optionIndex } = req.body;
    const activityId = req.params.id;

    if (firestore) {
      try {
        await firestore.collection('activities').doc(activityId).collection('votes').doc(req.user.id.toString()).set({
          option_index: optionIndex,
          voted_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ success: true });
      } catch (err) {
        return handleFirestoreError(res, err, "vote-activity");
      }
    }

    try {
      db.prepare(`
        INSERT OR REPLACE INTO activity_votes (activity_id, user_id, option_index)
        VALUES (?, ?, ?)
      `).run(activityId, req.user.id, optionIndex);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Dështoi votimi" });
    }
  });

  app.post("/api/activities/:id/action", authenticate, async (req: any, res) => {
    const { action } = req.body; 
    const activityId = req.params.id;

    if (firestore) {
      try {
        const doc = await firestore.collection('activities').doc(activityId).get();
        if (!doc.exists) return res.status(404).json({ error: "Aktiviteti nuk u gjet" });
        if (doc.data()?.user_id !== req.user.id.toString()) return res.status(403).json({ error: "Veprim i paautorizuar" });

        await firestore.collection('activities').doc(activityId).update({
          status: action === 'CLOSE_DONATION' ? 'CLOSED' : 'OPEN'
        });
        return res.json({ success: true });
      } catch (err) {
        return handleFirestoreError(res, err, "action-activity");
      }
    }

    try {
      const act = db.prepare("SELECT user_id FROM activities WHERE id = ?").get(activityId) as any;
      if (!act) return res.status(404).json({ error: "Aktiviteti nuk u gjet" });
      if (act.user_id !== req.user.id) return res.status(403).json({ error: "Veprim i paautorizuar" });

      db.prepare("UPDATE activities SET status = ? WHERE id = ?").run(
        action === 'CLOSE_DONATION' ? 'CLOSED' : 'OPEN',
        activityId
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Dështoi përditësimi i statusit" });
    }
  });

  app.get("/api/activities/:id/comments", authenticate, async (req: any, res) => {
    const activityId = req.params.id;
    if (firestore) {
      try {
        const commentsSnap = await firestore.collection('activities').doc(activityId).collection('comments').orderBy('created_at', 'asc').get();
        const comments = await Promise.all(commentsSnap.docs.map(async d => {
          const cData = d.data();
          const uDoc = await firestore.collection('users').doc(cData.user_id.toString()).get();
          const uData = uDoc.data();
          return {
            id: d.id,
            ...cData,
            user_name: uData ? `${uData.name} ${uData.surname || ''}` : 'Përdorues i panjohur',
            user_photo: uData ? uData.profile_photo : null
          };
        }));
        return res.json(comments);
      } catch (err) {
        return handleFirestoreError(res, err, "get-comments");
      }
    }

    try {
      const comments = db.prepare(`
        SELECT c.*, u.name as user_name, u.surname as user_surname, u.profile_photo as user_photo
        FROM activity_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.activity_id = ?
        ORDER BY c.created_at ASC
      `).all(activityId) as any[];
      res.json(comments.map(c => ({
        ...c,
        user_name: `${c.user_name} ${c.user_surname || ''}`
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Dështoi marrja e komenteve" });
    }
  });

  app.post("/api/activities/:id/comments", authenticate, async (req: any, res) => {
    const activityId = req.params.id;
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ error: "Komenti është i detyrueshëm" });

    const filteredComment = filterProfanity(comment);

    if (firestore) {
      try {
        const cRef = await firestore.collection('activities').doc(activityId).collection('comments').add({
          user_id: req.user.id.toString(),
          comment: filteredComment,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ id: cRef.id, comment: filteredComment, user_id: req.user.id });
      } catch (err) {
        return handleFirestoreError(res, err, "create-comment");
      }
    }

    try {
      const info = db.prepare(`
        INSERT INTO activity_comments (activity_id, user_id, comment)
        VALUES (?, ?, ?)
      `).run(activityId, req.user.id, filteredComment);
      res.json({ id: info.lastInsertRowid, comment: filteredComment, user_id: req.user.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Dështoi shtimi i komentit" });
    }
  });

  app.post("/api/study/confirm", authenticate, async (req: any, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "Session ID është i detyrueshëm" });
    let classId = null;
    const fullName = `${req.user.name} ${req.user.surname || ''}`.trim();
    
    if (firestore) {
      try {
        const sessionSnap = await firestore.collection('study_sessions').doc(sessionId.toString()).get();
        classId = sessionSnap.data()?.class_id;
        
        // CHECK FOR DUPLICATES
        const existingPresence = await firestore.collection('session_presence')
          .where('session_id', '==', sessionId.toString())
          .where('user_id', '==', req.user.id.toString())
          .get();
        
        if (!existingPresence.empty) {
          return res.status(400).json({ error: "Ju e keni konfirmuar tashmë prezencën për këtë sesion." });
        }

        await firestore.collection('session_presence').add({
          session_id: sessionId.toString(),
          user_id: req.user.id.toString(),
          is_verified: 0,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        if (classId) {
          io.to(`class_${classId}`).emit("presence_confirmed", { sessionId, userId: req.user.id, userName: fullName });
        } else {
          io.emit("presence_confirmed", { sessionId, userId: req.user.id, userName: fullName });
        }
        
        // Notify the student to refresh their history
        io.to(`user_${req.user.id}`).emit("presence_updated");
        
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "confirm-presence");
      }
    }

    // SQLite
    const existing = db.prepare("SELECT id FROM session_presence WHERE session_id = ? AND user_id = ?").get(sessionId, req.user.id);
    if (existing) return res.status(400).json({ error: "Ju e keni konfirmuar tashmë prezencën për këtë sesion." });

    const session = db.prepare("SELECT class_id FROM study_sessions WHERE id = ?").get(sessionId) as any;
    db.prepare("INSERT INTO session_presence (session_id, user_id) VALUES (?, ?)").run(sessionId, req.user.id);
    if (session) {
      io.to(`class_${session.class_id}`).emit("presence_confirmed", { sessionId, userId: req.user.id, userName: fullName });
    } else {
      io.emit("presence_confirmed", { sessionId, userId: req.user.id, userName: fullName });
    }
    
    // Notify the student to refresh their history
    io.to(`user_${req.user.id}`).emit("presence_updated");
    
    res.json({ success: true });
  });

  app.post("/api/study/verify", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { sessionId, userId } = req.body;
    
    if (!sessionId || !userId) return res.status(400).json({ error: "Session ID dhe User ID janë të detyrueshme" });

    if (firestore) {
      try {
        const snap = await firestore.collection('session_presence')
          .where('session_id', '==', sessionId.toString())
          .where('user_id', '==', userId.toString())
          .get();
        
        const batch = firestore.batch();
        snap.forEach(doc => batch.update(doc.ref, { is_verified: 1 }));
        
        batch.set(firestore.collection('attendance').doc(), {
          user_id: userId.toString(),
          status: 'PRESENT',
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
        const sessionSnap = await firestore.collection('study_sessions').doc(sessionId.toString()).get();
        const classId = sessionSnap.data()?.class_id;
        if (classId) {
          io.to(`class_${classId}`).emit("presence_verified", { sessionId, userId });
        } else {
          io.emit("presence_verified", { sessionId, userId });
        }
        io.to(`user_${userId}`).emit("presence_updated");
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "verify-presence");
      }
    }

    const session = db.prepare("SELECT class_id FROM study_sessions WHERE id = ?").get(sessionId) as any;
    db.prepare("UPDATE session_presence SET is_verified = 1 WHERE session_id = ? AND user_id = ?").run(sessionId, userId);
    
    // Log to attendance
    db.prepare("INSERT INTO attendance (user_id, status) VALUES (?, 'PRESENT')").run(userId);
    
    if (session) {
      io.to(`class_${session.class_id}`).emit("presence_verified", { sessionId, userId });
    } else {
      io.emit("presence_verified", { sessionId, userId });
    }
    io.to(`user_${userId}`).emit("presence_updated");
    res.json({ success: true });
  });

  app.get("/api/study/active", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        let session: any = null;
        if (req.user.role === 'TEACHER') {
          const snap = await firestore.collection('study_sessions')
            .where('status', '==', 'ACTIVE')
            .where('teacher_id', '==', req.user.id)
            .get();
          
          const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          sessions.sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
          session = sessions.length > 0 ? sessions[0] : null;
        } else {
          const memberSnap = await firestore.collection('class_members')
            .where('user_id', '==', req.user.id)
            .where('status', '==', 'CONFIRMED')
            .get();
          
          if (memberSnap.empty) return res.json(null);
          const classId = memberSnap.docs[0].data().class_id;
          
          const snap = await firestore.collection('study_sessions')
            .where('status', '==', 'ACTIVE')
            .where('class_id', '==', classId)
            .get();
          
          const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          sessions.sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
          
          if (sessions.length > 0) {
            session = sessions[0];
            const teacher_id_str = session.teacher_id?.toString();
            const teacherSnap = teacher_id_str ? await firestore.collection('users').doc(teacher_id_str).get() : null;
            const teacher = teacherSnap?.data();
            session.teacherName = `${teacher?.name || ''} ${teacher?.surname || ''}`.trim() || 'Pedagogu';
          }
        }

        if (!session) return res.json(null);

        const presenceSnap = await firestore.collection('session_presence')
          .where('session_id', '==', session.id)
          .get();
        
        const uniqueSet = new Set();
        const presence = [];
        for (const doc of presenceSnap.docs) {
          const data = doc.data();
          const user_id_str = data.user_id?.toString();
          if (user_id_str && !uniqueSet.has(user_id_str)) {
            uniqueSet.add(user_id_str);
            const uSnap = await firestore.collection('users').doc(user_id_str).get();
            const uData = uSnap.data();
            presence.push({ 
              ...data, 
              userId: data.user_id, // Ensure consistent field name
              userName: `${uData?.name || ''} ${uData?.surname || ''}`.trim() 
            });
          }
        }

        return res.json({ ...session, presence });
      } catch (e) {
        return handleFirestoreError(res, e, "get-active-study");
      }
    }

    let session;
    if (req.user.role === 'TEACHER') {
      session = db.prepare("SELECT * FROM study_sessions WHERE status = 'ACTIVE' AND teacher_id = ? ORDER BY created_at DESC LIMIT 1").get(req.user.id);
    } else {
      // Find active session for the student's class
      session = db.prepare(`
        SELECT ss.*, u.name as teacherName 
        FROM study_sessions ss
        JOIN users u ON ss.teacher_id = u.id
        JOIN class_members cm ON ss.class_id = cm.class_id
        WHERE ss.status = 'ACTIVE' AND cm.user_id = ? AND cm.status = 'CONFIRMED'
        ORDER BY ss.created_at DESC LIMIT 1
      `).get(req.user.id);
    }
    
    if (!session) return res.json(null);
    
    const presence = db.prepare(`
      SELECT sp.user_id, sp.user_id as userId, sp.session_id, sp.is_verified, (u.name || ' ' || COALESCE(u.surname, '')) as userName 
      FROM session_presence sp 
      JOIN users u ON sp.user_id = u.id 
      WHERE sp.session_id = ?
      GROUP BY sp.user_id
    `).all(session.id);
    
    res.json({ ...session, presence });
  });

  app.get("/api/attendance/stats", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const snap = await firestore.collection('attendance')
          .where('user_id', '==', req.user.id.toString())
          .get();
        
        const counts: Record<string, number> = {};
        snap.docs.forEach(doc => {
          const status = doc.data().status;
          counts[status] = (counts[status] || 0) + 1;
        });

        const stats = Object.entries(counts).map(([status, count]) => ({ status, count }));
        return res.json(stats);
      } catch (e) {
        console.error("Firestore Attendance Stats Error:", e);
      }
    }
    const stats = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM attendance 
      WHERE user_id = ? 
      GROUP BY status
    `).all(req.user.id);
    res.json(stats);
  });

  // Tests
  app.get("/api/tests", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        let tests;
        if (req.user.role === 'TEACHER') {
          const snap = await firestore.collection('tests')
            .where('teacher_id', '==', req.user.id)
            .get();
          tests = snap.docs.map(doc => doc.data());
          tests.sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
        } else {
          const snap = await firestore.collection('tests')
            .where('status', 'in', ['ACTIVE', 'IN_PROGRESS', 'PUBLISHED'])
            .get();
          
          tests = snap.docs.map(doc => doc.data())
            .filter((t: any) => {
              const uP = (req.user.program || '').trim().toUpperCase();
              const uY = (req.user.year || '').trim().toUpperCase();
              const uG = (req.user.group_name || '').trim().toUpperCase();
              
              const tP = (t.program || '').trim().toUpperCase();
              const tY = (t.year || '').trim().toUpperCase();
              const tG = (t.group_name || '').trim().toUpperCase();
              
              return tP === uP && tY === uY && tG === uG;
            });

          tests.sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
        }
        return res.json(tests);
      } catch (e) {
        return handleFirestoreError(res, e, "get-tests");
      }
    }
    let tests;
    if (req.user.role === 'TEACHER') {
      tests = db.prepare("SELECT * FROM tests WHERE teacher_id = ? ORDER BY created_at DESC").all(req.user.id);
    } else {
      tests = db.prepare(`
        SELECT * FROM tests 
        WHERE status IN ('ACTIVE', 'IN_PROGRESS', 'PUBLISHED') 
        AND TRIM(UPPER(program)) = TRIM(UPPER(?)) 
        AND TRIM(UPPER(year)) = TRIM(UPPER(?)) 
        AND TRIM(UPPER(group_name)) = TRIM(UPPER(?)) 
        ORDER BY created_at DESC
      `).all(req.user.program || '', req.user.year || '', req.user.group_name || '');
    }
    res.json(tests);
  });

  app.post("/api/tests", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të krijojnë teste" });
    const { title, description, duration, totalPoints, testDate, program, year, group_name } = req.body;
    
    if (firestore) {
      try {
        const testRef = firestore.collection('tests').doc();
        const testId = testRef.id;
        const testData = {
          id: testId,
          title, description, duration, total_points: totalPoints,
          teacher_id: req.user.id,
          test_date: testDate,
          program, year, group_name,
          status: 'DRAFT',
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await testRef.set(testData);
        return res.json({ id: testId });
      } catch (e) {
        return handleFirestoreError(res, e, "create-test");
      }
    }

    const info = db.prepare("INSERT INTO tests (title, description, duration, total_points, teacher_id, test_date, program, year, group_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')")
      .run(title, description, duration, totalPoints, req.user.id, testDate, program, year, group_name);
    
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/tests/:id/status", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të ndryshojnë statusin" });
    const { status } = req.body;
    
    if (firestore) {
      try {
        await firestore.collection('tests').doc(req.params.id).update({ status });
        io.emit("test_updated", { id: req.params.id, status });
        if (status === 'ACTIVE' || status === 'PUBLISHED') {
          io.emit("test_distributed", { testId: req.params.id, title: "Test i ri u shpërnda!" });
          
          const testSnap = await firestore.collection('tests').doc(req.params.id).get();
          const test = testSnap.data();
          if (test) {
            const studentsSnap = await firestore.collection('users')
              .where('role', '==', 'STUDENT')
              .where('program', '==', test.program)
              .where('year', '==', test.year)
              .where('group_name', '==', test.group_name)
              .get();
            
            const batch = firestore.batch();
            studentsSnap.forEach(doc => {
              batch.set(firestore.collection('notifications').doc(), {
                user_id: doc.id,
                title: "Test u Publikua: " + test.title,
                content: `Testi është i gatshëm për t'u plotësuar.`,
                type: 'TEST',
                target_id: req.params.id,
                target_type: 'TEST',
                created_at: admin.firestore.FieldValue.serverTimestamp()
              });
            });
            await batch.commit();
          }
        }
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "update-test-status");
      }
    }

    db.prepare("UPDATE tests SET status = ? WHERE id = ?").run(status, req.params.id);
    
    if (status === 'ACTIVE') {
      io.emit("test_distributed", { id: req.params.id });
    } else {
      io.emit("test_updated", { id: req.params.id, status });
    }
    
    if (status === 'ACTIVE' || status === 'PUBLISHED') {
      io.emit("test_distributed", { testId: req.params.id, title: "Test i ri u shpërnda!" });
      
      const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(req.params.id) as any;
      if (test) {
        const students = db.prepare("SELECT id FROM users WHERE role = 'STUDENT' AND program = ? AND year = ? AND group_name = ?")
          .all(test.program, test.year, test.group_name) as any[];
        for (const s of students) {
          await notifyUser(s.id, "Test u Publikua: " + test.title, `Testi është i gatshëm për t'u plotësuar.`, 'TEST', req.params.id, 'TEST');
        }
      }
    }
    
    res.json({ success: true });
  });

  app.get("/api/classes/:id/database", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { month, year } = req.query; // format month: 1-12, year: YYYY
    const classId = req.params.id;

    const isFullExport = !month || !year;

    if (firestore) {
      try {
        // Fetch all students in the class
        const membersSnap = await firestore.collection('class_members')
          .where('class_id', '==', classId)
          .where('status', '==', 'CONFIRMED')
          .get();
        
        const studentIds = membersSnap.docs.map(doc => doc.data().user_id?.toString()).filter(id => id);
        if (studentIds.length === 0) return res.json([]);

        const students = await Promise.all(studentIds.map(async id => {
          const uSnap = await firestore.collection('users').doc(id).get();
          return { id, ...uSnap.data() };
        }));

        // Sort students alphabetically
        students.sort((a: any, b: any) => (a.name + a.surname).localeCompare(b.name + b.surname));

        let startDate = new Date(0);
        let endDate = new Date(8640000000000000); // Far future

        if (!isFullExport) {
          startDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
          endDate = new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59);
        }

        const database = await Promise.all(students.map(async (st: any) => {
          // Fetch test grades for this month
          const attemptsSnap = await firestore.collection('test_attempts')
            .where('user_id', '==', st.id.toString())
            .where('status', '==', 'GRADED')
            .get();
          
          const testGrades = attemptsSnap.docs
            .map(doc => doc.data())
            .filter(a => {
              const d = a.end_time?.toDate() || new Date();
              return d >= startDate && d <= endDate;
            })
            .map(a => ({ title: 'Test', grade: a.grade, date: a.end_time?.toDate() }));

          // Fetch homework grades for this month
          const submissionsSnap = await firestore.collection('submissions')
            .where('student_id', '==', st.id.toString())
            .where('status', '==', 'GRADED')
            .get();
            
          const homeworkGrades = submissionsSnap.docs
            .map(doc => doc.data())
            .filter(s => {
              const d = s.graded_at?.toDate() || new Date();
              return d >= startDate && d <= endDate;
            })
            .map(s => ({ title: 'Detyrë', grade: s.grade, date: s.graded_at?.toDate() }));

          // Fetch presence for this month
          const presenceSnap = await firestore.collection('session_presence')
            .where('user_id', '==', st.id.toString())
            .get();
          
          const presenceCount = presenceSnap.docs
            .map(doc => doc.data())
            .filter(p => {
              const d = p.timestamp?.toDate() || new Date();
              return d >= startDate && d <= endDate;
            }).length;

          return {
            id: st.id,
            name: st.name,
            surname: st.surname,
            grades: [...testGrades, ...homeworkGrades],
            presence: presenceCount
          };
        }));

        return res.json(database);
      } catch (e) {
        return handleFirestoreError(res, e, "get-class-database");
      }
    }

    // SQLite Implementation
    let datePrefix = '%';
    if (!isFullExport) {
      const monthStr = month?.toString().padStart(2, '0');
      datePrefix = `${year}-${monthStr}%`;
    }

    const students = db.prepare(`
      SELECT u.id, u.name, u.surname
      FROM users u
      JOIN class_members cm ON u.id = cm.user_id
      WHERE cm.class_id = ? AND cm.status = 'CONFIRMED'
      ORDER BY u.name ASC, u.surname ASC
    `).all(classId) as any[];

    const database = students.map(st => {
      const testGrades = db.prepare(`
        SELECT grade, end_time as date
        FROM test_attempts
        WHERE user_id = ? AND status = 'GRADED' AND end_time LIKE ?
      `).all(st.id, datePrefix);

      const homeworkGrades = db.prepare(`
        SELECT grade, graded_at as date
        FROM submissions
        WHERE student_id = ? AND status = 'GRADED' AND graded_at LIKE ?
      `).all(st.id, datePrefix);

      const presenceCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM session_presence
        WHERE user_id = ? AND timestamp LIKE ?
      `).get(st.id, datePrefix) as any;

      return {
        id: st.id,
        name: st.name,
        surname: st.surname,
        grades: [
          ...testGrades.map(g => ({ title: 'Test', ...g })),
          ...homeworkGrades.map(g => ({ title: 'Detyrë', ...g }))
        ],
        presence: presenceCount.count
      };
    });

    res.json(database);
  });

  app.get("/api/classes/:id", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        if (req.params.id && req.params.id.startsWith('VIRT_')) {
           const schedId = req.params.id.replace('VIRT_', '');
           const schedDoc = await firestore.collection('schedules').doc(schedId).get();
           let sData: any = null;
           if (schedDoc.exists) {
              sData = schedDoc.data();
           } else {
              const tsDoc = await firestore.collection('teacher_schedule').doc(schedId).get();
              if (tsDoc.exists) sData = tsDoc.data();
           }

           if (sData) {
              return res.json({
                id: req.params.id,
                name: `${sData.subject || sData.program} - ${sData.year}`,
                department: sData.program || 'Fakulteti',
                year: sData.year || 'Gjithë Viteve',
                studentCount: 0,
                virtual: true
              });
           }
        }
        const doc = await firestore.collection('classes').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: "Klasa nuk u gjet" });
        
        const countSnap = await firestore.collection('class_members')
          .where('class_id', '==', req.params.id)
          .where('status', '==', 'CONFIRMED')
          .get();
          
        return res.json({ id: doc.id, ...doc.data(), studentCount: countSnap.size });
      } catch (e) {
        return handleFirestoreError(res, e, "get-class-details");
      }
    }
    if (req.params.id && req.params.id.startsWith('VIRT_')) {
      const schedId = req.params.id.replace('VIRT_', '');
      const s = db.prepare("SELECT * FROM teacher_schedule WHERE id = ?").get(schedId) as any;
      if (s) {
        return res.json({
          id: req.params.id,
          name: `${s.subject} - ${s.program}`,
          department: s.program,
          year: s.year,
          group_name: s.group_name,
          studentCount: 0,
          virtual: true
        });
      }
    }
    const cls = db.prepare("SELECT * FROM classes WHERE id = ?").get(req.params.id);
    if (!cls) return res.status(404).json({ error: "Klasa nuk u gjet" });
    const count = db.prepare("SELECT COUNT(*) as count FROM class_members WHERE class_id = ? AND status = 'CONFIRMED'").get(req.params.id);
    res.json({ ...cls, studentCount: count.count });
  });

  app.get("/api/classes/:id/students", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const snap = await firestore.collection('class_members')
          .where('class_id', '==', req.params.id)
          .where('status', '==', 'CONFIRMED')
          .get();
        
        const students = await Promise.all(snap.docs.map(async doc => {
          const m = doc.data();
          const user_id_str = m.user_id?.toString();
          const uSnap = user_id_str ? await firestore.collection('users').doc(user_id_str).get() : null;
          const u = uSnap?.data();
          
          // Basic progress stats
          const logsSnap = user_id_str ? await firestore.collection('performance_logs')
            .where('user_id', '==', user_id_str)
            .get() : { docs: [] };
          
          const logs = logsSnap.docs.map(d => d.data());
          const avgScore = logs.length > 0 
            ? logs.reduce((acc, curr) => acc + (curr.score / curr.max_score), 0) / logs.length 
            : 0;

          return {
            id: u.id,
            name: u.name,
            surname: u.surname,
            profile_photo: u.profile_photo,
            email: u.email,
            is_confirmed: u.is_confirmed,
            progress: Math.round(avgScore * 100),
            activityCount: logs.length
          };
        }));
        
        return res.json(students);
      } catch (e) {
        return handleFirestoreError(res, e, "get-class-students");
      }
    }
    const members = db.prepare(`
      SELECT u.id, u.name, u.surname, u.profile_photo, u.email, u.is_confirmed
      FROM class_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.class_id = ? AND cm.status = 'CONFIRMED'
    `).all(req.params.id) as any[];

    const studentsWithProgress = members.map(s => {
      const stats = db.prepare(`
        SELECT AVG(score / max_score) as avg, COUNT(*) as count
        FROM performance_logs
        WHERE user_id = ?
      `).get(s.id) as any;
      
      return {
        ...s,
        progress: Math.round((stats.avg || 0) * 100),
        activityCount: stats.count
      };
    });

    res.json(studentsWithProgress);
  });

  // Questions
  app.get("/api/tests/:id/questions", authenticate, async (req, res) => {
    if (firestore) {
      try {
        const snap = await firestore.collection('questions').where('test_id', '==', req.params.id).get();
        const questions = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            content: data.content,
            type: data.type,
            options: typeof data.options === 'string' ? JSON.parse(data.options) : data.options,
            points: data.points,
            correct_answer: data.correct_answer
          };
        });
        return res.json(questions);
      } catch (e) {
        return handleFirestoreError(res, e, "get-test-questions");
      }
    }
    const questions = db.prepare("SELECT id, content, type, options, points, correct_answer FROM questions WHERE test_id = ?").all(req.params.id) as any[];
    const parsedQuestions = questions.map(q => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null
    }));
    res.json(parsedQuestions);
  });

  app.post("/api/tests/:id/questions", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të shtojnë pyetje" });
    const { content, type, options, points, correct_answer } = req.body;
    
    if (firestore) {
      try {
        const qRef = firestore.collection('questions').doc();
        await qRef.set({
          id: qRef.id,
          test_id: req.params.id,
          content, type,
          options: options ? JSON.stringify(options) : null,
          points, correct_answer
        });
        return res.json({ id: qRef.id });
      } catch (e) {
        return handleFirestoreError(res, e, "create-test-question");
      }
    }

    const info = db.prepare("INSERT INTO questions (test_id, content, type, options, points, correct_answer) VALUES (?, ?, ?, ?, ?, ?)")
      .run(req.params.id, content, type, options ? JSON.stringify(options) : null, points, correct_answer);
    res.json({ id: info.lastInsertRowid });
  });

  // Test Attempts & Participation
  app.post("/api/tests/:id/join", authenticate, async (req: any, res) => {
    if (req.user.role !== 'STUDENT') return res.status(403).json({ error: "Vetëm studentët mund të hyjnë në test" });
    
    if (firestore) {
      try {
        const snap = await firestore.collection('test_attempts')
          .where('test_id', '==', req.params.id)
          .where('user_id', '==', req.user.id)
          .get();
        
        if (!snap.empty) return res.json(snap.docs[0].data());

        const attemptRef = firestore.collection('test_attempts').doc();
        const attemptData = {
          id: attemptRef.id,
          test_id: req.params.id,
          user_id: req.user.id,
          status: 'STARTED',
          start_time: admin.firestore.FieldValue.serverTimestamp()
        };
        await attemptRef.set(attemptData);
        
        io.emit("student_joined_test", { testId: req.params.id, studentName: req.user.name, userId: req.user.id });
        return res.json(attemptData);
      } catch (e) {
        return handleFirestoreError(res, e, "join-test");
      }
    }

    // Check if already joined
    const existing = db.prepare("SELECT * FROM test_attempts WHERE test_id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (existing) return res.json(existing);

    const info = db.prepare("INSERT INTO test_attempts (test_id, user_id) VALUES (?, ?)")
      .run(req.params.id, req.user.id);
    
    const attempt = { id: info.lastInsertRowid, test_id: req.params.id, user_id: req.user.id, status: 'STARTED' };
    io.emit("student_joined_test", { testId: req.params.id, studentName: req.user.name, userId: req.user.id });
    
    res.json(attempt);
  });

  app.post("/api/attempts/:id/save", authenticate, async (req: any, res) => {
    const { answers } = req.body; // Array of { questionId, answerText }
    
    if (firestore) {
      try {
        const batch = firestore.batch();
        for (const ans of answers) {
          const ansSnap = await firestore.collection('test_answers')
            .where('attempt_id', '==', req.params.id)
            .where('question_id', '==', ans.questionId)
            .get();
          
          if (!ansSnap.empty) {
            batch.update(ansSnap.docs[0].ref, { answer_text: ans.answerText });
          } else {
            batch.set(firestore.collection('test_answers').doc(), {
              attempt_id: req.params.id,
              user_id: req.user.id,
              question_id: ans.questionId,
              answer_text: ans.answerText
            });
          }
        }
        await batch.commit();
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "save-test-answers");
      }
    }

    db.transaction(() => {
      for (const ans of answers) {
        const existing = db.prepare("SELECT id FROM test_answers WHERE attempt_id = ? AND question_id = ?")
          .get(req.params.id, ans.questionId) as any;
        
        if (existing) {
          db.prepare("UPDATE test_answers SET answer_text = ? WHERE id = ?")
            .run(ans.answerText, existing.id);
        } else {
          db.prepare("INSERT INTO test_answers (attempt_id, question_id, answer_text) VALUES (?, ?, ?)")
            .run(req.params.id, ans.questionId, ans.answerText);
        }
      }
    })();
    
    res.json({ success: true });
  });

  app.post("/api/attempts/:id/submit", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        await firestore.collection('test_attempts').doc(req.params.id).update({
          status: 'SUBMITTED',
          end_time: admin.firestore.FieldValue.serverTimestamp()
        });
        const attemptSnap = await firestore.collection('test_attempts').doc(req.params.id).get();
        const attempt = attemptSnap.data();
        
        // Broadcast both specific and general events
        io.emit("student_submitted_test", { testId: attempt?.test_id, studentName: req.user.name, userId: req.user.id });
        io.emit("submission_updated"); 
        
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "submit-test");
      }
    }

    db.prepare("UPDATE test_attempts SET status = 'SUBMITTED', end_time = CURRENT_TIMESTAMP WHERE id = ?")
      .run(req.params.id);
    
    const attempt = db.prepare("SELECT test_id FROM test_attempts WHERE id = ?").get(req.params.id) as any;
    
    // Broadcast both specific and general events
    io.emit("student_submitted_test", { testId: attempt.test_id, studentName: req.user.name, userId: req.user.id });
    io.emit("submission_updated");
    
    res.json({ success: true });
  });

  app.get("/api/tests/:id/monitoring", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të monitorojnë" });
    
    if (firestore) {
      try {
        const snap = await firestore.collection('test_attempts').where('test_id', '==', req.params.id).get();
        const participants = await Promise.all(snap.docs.map(async doc => {
          const data = doc.data();
          const uSnap = await firestore.collection('users').doc(data.user_id.toString()).get();
          const uData = uSnap.data();
          return {
            name: `${uData?.name || ''} ${uData?.surname || ''}`.trim(),
            status: data.status,
            start_time: data.start_time?.toDate()?.toISOString(),
            end_time: data.end_time?.toDate()?.toISOString(),
            attempt_id: doc.id
          };
        }));
        return res.json(participants);
      } catch (e) {
        return handleFirestoreError(res, e, "monitor-test");
      }
    }

    const participants = db.prepare(`
      SELECT (u.name || ' ' || COALESCE(u.surname, '')) as name, ta.status, ta.start_time, ta.end_time, ta.id as attempt_id
      FROM test_attempts ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.test_id = ?
    `).all(req.params.id);
    
    res.json(participants);
  });

  app.get("/api/attempts/:id/details", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const attemptSnap = await firestore.collection('test_attempts').doc(req.params.id).get();
        const attempt = attemptSnap.data();
        if (!attempt) return res.status(404).json({ error: "Tentativa nuk u gjet" });

        const user_id_str = attempt.user_id?.toString();
        const test_id_str = attempt.test_id?.toString();
        
        const userSnap = user_id_str ? await firestore.collection('users').doc(user_id_str).get() : null;
        const testSnap = test_id_str ? await firestore.collection('tests').doc(test_id_str).get() : null;
        
        const answersSnap = await firestore.collection('test_answers').where('attempt_id', '==', req.params.id).get();
        const answers = await Promise.all(answersSnap.docs.map(async doc => {
          const data = doc.data();
          const q_id_str = data.question_id?.toString();
          const qSnap = q_id_str ? await firestore.collection('questions').doc(q_id_str).get() : null;
          const q = qSnap?.data();
          return {
            ...data,
            id: doc.id,
            question_text: q?.content,
            question_type: q?.type,
            options: q?.options,
            max_points: q?.points,
            correct_answer: q?.correct_answer
          };
        }));

        return res.json({
          attempt: {
            ...attempt,
            student_name: userSnap?.data()?.name,
            test_title: testSnap?.data()?.title
          },
          answers
        });
      } catch (e) {
        return handleFirestoreError(res, e, "get-attempt-details");
      }
    }

    const attempt = db.prepare(`
      SELECT ta.*, u.name as student_name, t.title as test_title
      FROM test_attempts ta
      JOIN users u ON ta.user_id = u.id
      JOIN tests t ON ta.test_id = t.id
      WHERE ta.id = ?
    `).get(req.params.id);

    const answers = db.prepare(`
      SELECT ta.*, q.content as question_text, q.type as question_type, q.options, q.points as max_points, q.correct_answer
      FROM test_answers ta
      JOIN questions q ON ta.question_id = q.id
      WHERE ta.attempt_id = ?
    `).all(req.params.id);

    res.json({ attempt, answers });
  });

  app.post("/api/attempts/:id/grade", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të vlerësojnë" });
    const { grades, feedback, finalGrade } = req.body; // Array of { answerId, points, isCorrect }, finalGrade 4-10
    
    if (firestore) {
      try {
        const batch = firestore.batch();
        let totalScore = 0;
        for (const g of grades) {
          batch.update(firestore.collection('test_answers').doc(g.answerId), {
            points_awarded: g.points,
            is_correct: g.isCorrect ? 1 : 0
          });
          totalScore += g.points;
        }
        
        batch.update(firestore.collection('test_attempts').doc(req.params.id), {
          total_score: totalScore,
          grade: finalGrade,
          status: 'GRADED',
          feedback
        });
        
        const attemptSnap = await firestore.collection('test_attempts').doc(req.params.id).get();
        const attempt = attemptSnap.data();
        if (attempt) {
          const test_id_str = attempt.test_id?.toString();
          const testSnap = test_id_str ? await firestore.collection('tests').doc(test_id_str).get() : null;
          const test = testSnap?.data();
          
          let teacher = null;
          if (test?.teacher_id) {
            const tSnap = await firestore.collection('users').doc(test.teacher_id.toString()).get();
            teacher = tSnap.data();
          }

          const logType = attempt.is_exam ? 'EXAM' : 'TEST';
          batch.set(firestore.collection('performance_logs').doc(), {
            user_id: attempt.user_id,
            type: logType,
            score: finalGrade,
            max_score: 10,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

          const notificationTitle = attempt.is_exam ? "Rezultati i Provimit: " : "Rezultati i Testit: ";
          batch.set(firestore.collection('notifications').doc(), {
            user_id: attempt.user_id,
            title: notificationTitle + test?.title,
            content: `Mësuesi ${teacher?.name} ju ka vlerësuar me notën ${finalGrade}.`,
            type: 'GRADE',
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        await batch.commit();
        io.to(`user_${attempt.user_id}`).emit("new_notification");
        io.to(`user_${attempt.user_id}`).emit("score_updated");
        io.to("teachers").emit("score_updated");
        return res.json({ success: true, totalScore });
      } catch (e) {
        return handleFirestoreError(res, e, "grade-attempt");
      }
    }

    let totalScore = 0;
    let attempt: any = null;
    
    db.transaction(() => {
      for (const g of grades) {
        db.prepare("UPDATE test_answers SET points_awarded = ?, is_correct = ? WHERE id = ?")
          .run(g.points, g.isCorrect ? 1 : 0, g.answerId);
        totalScore += g.points;
      }
      db.prepare("UPDATE test_attempts SET total_score = ?, grade = ?, status = 'GRADED', feedback = ? WHERE id = ?")
        .run(totalScore, finalGrade, feedback, req.params.id);
      
      attempt = db.prepare(`
        SELECT ta.user_id, ta.is_exam, t.id as test_id, t.total_points, t.title, t.teacher_id, u.name as teacher_name
        FROM test_attempts ta 
        JOIN tests t ON ta.test_id = t.id 
        JOIN users u ON t.teacher_id = u.id
        WHERE ta.id = ?
      `).get(req.params.id) as any;

      if (attempt) {
        // Log to performance using the 4-10 grade
        const logType = attempt.is_exam ? 'EXAM' : 'TEST';
        db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score) VALUES (?, ?, ?, 10)")
          .run(attempt.user_id, logType, finalGrade);
      }
    })();

    if (attempt) {
      // Notify student
      const notificationTitle = attempt.is_exam ? "Rezultati i Provimit: " : "Rezultati i Testit: ";
      await notifyUser(attempt.user_id, notificationTitle + attempt.title, `Mësuesi ${attempt.teacher_name} ju ka vlerësuar me notën ${finalGrade}.`, 'GRADE', attempt.test_id, 'TEST');
      
      io.to(`user_${attempt.user_id}`).emit("score_updated");
      io.to("teachers").emit("score_updated");
    }
    
    res.json({ success: true, totalScore });
  });

  app.get("/api/tests/:id/analytics", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const attemptsSnap = await firestore.collection('test_attempts')
          .where('test_id', '==', req.params.id)
          .where('status', '==', 'GRADED')
          .get();
        
        const testSnap = await firestore.collection('tests').doc(req.params.id).get();
        const test = testSnap.data();
        
        if (attemptsSnap.empty) return res.json({ message: "Nuk ka të dhëna për analizë" });

        const scores = attemptsSnap.docs.map(doc => doc.data().total_score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const passRate = (scores.filter(s => s >= (test?.total_points || 100) * 0.4).length / scores.length) * 100;

        return res.json({
          averageScore: avg,
          passRate,
          totalAttempts: scores.length,
          distribution: scores
        });
      } catch (e) {
        return handleFirestoreError(res, e, "get-test-analytics");
      }
    }

    const attempts = db.prepare("SELECT total_score FROM test_attempts WHERE test_id = ? AND status = 'GRADED'").all(req.params.id) as any[];
    const test = db.prepare("SELECT total_points FROM tests WHERE id = ?").get(req.params.id) as any;
    
    if (attempts.length === 0) return res.json({ message: "Nuk ka të dhëna për analizë" });

    const scores = attempts.map(a => a.total_score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const passRate = (scores.filter(s => s >= test.total_points * 0.4).length / scores.length) * 100;

    res.json({
      averageScore: avg,
      passRate,
      totalAttempts: attempts.length,
      distribution: scores
    });
  });

  app.get("/api/student/results", authenticate, async (req: any, res) => {
    if (req.user.role !== 'STUDENT') return res.status(403).json({ error: "Vetëm studentët mund të shohin rezultatet" });
    if (firestore) {
      try {
        const snap = await firestore.collection('test_attempts')
          .where('user_id', '==', req.user.id.toString())
          .get();
        const results = await Promise.all(snap.docs.map(async doc => {
          const data = doc.data();
          const test_id_str = data.test_id?.toString();
          const tSnap = test_id_str ? await firestore.collection('tests').doc(test_id_str).get() : null;
          const testData = tSnap?.data();
          
          let teacherName = 'Pedagogu';
          if (testData?.teacher_id) {
            const uSnap = await firestore.collection('users').doc(testData.teacher_id.toString()).get();
            const teacher = uSnap.data();
            if (teacher) teacherName = `${teacher.name} ${teacher.surname}`;
          }

          return {
            ...data,
            id: doc.id,
            title: testData?.title,
            test_date: testData?.test_date,
            teacher_name: teacherName
          };
        }));
        // Filter graded or submitted tests
        return res.json(results.filter((r: any) => r.status === 'GRADED' || r.status === 'COMPLETED' || r.status === 'SUBMITTED'));
      } catch (e) {
        return handleFirestoreError(res, e, "get-student-results");
      }
    }
    const results = db.prepare(`
      SELECT ta.*, t.title 
      FROM test_attempts ta 
      JOIN tests t ON ta.test_id = t.id 
      WHERE ta.user_id = ? AND ta.status IN ('GRADED', 'SUBMITTED')
    `).all(req.user.id);
    res.json(results);
  });

  app.get("/api/analytics/class", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të shohin analitikën e klasës" });
    const classId = req.query.classId;

    if (firestore) {
      try {
        let userIds: string[] = [];
        if (classId) {
          const membersSnap = await firestore.collection('class_members')
            .where('class_id', '==', classId.toString())
            .where('status', '==', 'CONFIRMED')
            .get();
          userIds = membersSnap.docs.map(doc => doc.data().user_id.toString());
        }

        const logsSnap = await firestore.collection('performance_logs').get();
        let logs = logsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));

        if (classId) {
          logs = logs.filter(l => userIds.includes(l.user_id?.toString()));
        }

        const userPerformance: Record<string, { total: number, count: number }> = {};
        const monthPerformance: Record<string, { total: number, count: number }> = {};
        
        logs.forEach(log => {
          const score = (log.score || 0) / (log.max_score || 10);
          
          if (!userPerformance[log.user_id]) userPerformance[log.user_id] = { total: 0, count: 0 };
          userPerformance[log.user_id].total += score;
          userPerformance[log.user_id].count += 1;

          // Bucket by month
          const date = log.created_at ? log.created_at.toDate() : new Date();
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          if (!monthPerformance[monthKey]) monthPerformance[monthKey] = { total: 0, count: 0 };
          monthPerformance[monthKey].total += score;
          monthPerformance[monthKey].count += 1;
        });

        const topImprovers = await Promise.all(
          Object.entries(userPerformance)
            .map(async ([userId, perf]) => {
              const uSnap = await firestore.collection('users').doc(userId).get();
              const uData = uSnap.data();
              return {
                id: userId,
                name: uData?.name,
                surname: uData?.surname || '',
                avg_perf: perf.total / perf.count
              };
            })
        );

        topImprovers.sort((a, b) => b.avg_perf - a.avg_perf);

        const classProgress = Object.entries(monthPerformance)
          .map(([month, data]) => ({
            month,
            avg_perf: data.total / data.count
          }))
          .sort((a, b) => a.month.localeCompare(b.month));

        const averageScore = classProgress.reduce((acc, curr) => acc + curr.avg_perf, 0) / (classProgress.length || 1);

        return res.json({ 
          averageScore: averageScore * 100, 
          classProgress,
          topImprovers: topImprovers.slice(0, 10)
        });
      } catch (e) {
        return handleFirestoreError(res, e, "get-class-analytics");
      }
    }

    try {
      const classId = req.query.classId;
      let logsBase = `SELECT pl.*, u.name, u.surname, u.group_name 
                      FROM performance_logs pl
                      JOIN users u ON pl.user_id = u.id`;
      let logsParams: any[] = [];

      let topImproversBase = `SELECT u.id, u.name, u.surname, AVG(CAST(score AS FLOAT)/max_score) as avg_perf 
                              FROM performance_logs pl
                              JOIN users u ON pl.user_id = u.id`;
      let topImproversParams: any[] = [];

      let progressBase = `SELECT 
                            strftime('%Y-%m', timestamp) as month,
                            AVG(CAST(score AS FLOAT)/max_score) as avg_perf 
                          FROM performance_logs pl`;
      let progressParams: any[] = [];

      if (classId) {
        logsBase += ` JOIN class_members cm ON pl.user_id = cm.user_id 
                      WHERE cm.class_id = ? AND cm.status = 'CONFIRMED'`;
        logsParams.push(classId);

        topImproversBase += ` JOIN class_members cm ON pl.user_id = cm.user_id 
                               WHERE cm.class_id = ? AND cm.status = 'CONFIRMED'`;
        topImproversParams.push(classId);

        progressBase += ` JOIN class_members cm ON pl.user_id = cm.user_id 
                           WHERE cm.class_id = ? AND cm.status = 'CONFIRMED'`;
        progressParams.push(classId);
      }

      topImproversBase += ` GROUP BY pl.user_id ORDER BY avg_perf DESC LIMIT 10`;
      progressBase += ` GROUP BY month ORDER BY month ASC`;

      const topImprovers = db.prepare(topImproversBase).all(topImproversParams) as any[];
      const classProgress = db.prepare(progressBase).all(progressParams) as any[];
      const logs = db.prepare(logsBase).all(logsParams) as any[];
      
      const attendanceBase = classId 
        ? `SELECT a.status, COUNT(*) as count FROM attendance a JOIN class_members cm ON a.user_id = cm.user_id WHERE cm.class_id = ? AND cm.status = 'CONFIRMED' GROUP BY a.status`
        : `SELECT status, COUNT(*) as count FROM attendance GROUP BY status`;
      const attendanceParams = classId ? [classId] : [];
      const attendance = db.prepare(attendanceBase).all(attendanceParams) as any[];

      const averageScore = classProgress.reduce((acc, curr) => acc + curr.avg_perf, 0) / (classProgress.length || 1);

      res.json({ averageScore: averageScore * 100, logs, attendance, topImprovers, classProgress });
    } catch (err: any) {
      console.error("Analytics Class Fetch Error:", err);
      res.status(500).json({ error: "Gabim në të dhënat e analytics" });
    }
  });

  app.get("/api/analytics/student/:id", authenticate, async (req: any, res) => {
    const userId = req.params.id === 'me' ? req.user.id : req.params.id;
    
    if (firestore) {
      try {
        const logsSnap = await firestore.collection('performance_logs')
          .where('user_id', '==', userId.toString())
          .get();
        
        const logs = logsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            timestamp: data.created_at?.toDate()?.toISOString()
          };
        });

        // Sort in memory to avoid composite index requirement
        logs.sort((a: any, b: any) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB;
        });

        const attendanceSnap = await firestore.collection('attendance')
          .where('user_id', '==', userId.toString())
          .get();
        
        const attendanceCounts: Record<string, number> = {};
        attendanceSnap.docs.forEach(doc => {
          const status = doc.data().status;
          attendanceCounts[status] = (attendanceCounts[status] || 0) + 1;
        });

        const attendance = Object.entries(attendanceCounts).map(([status, count]) => ({ status, count }));

        return res.json({ logs, attendance });
      } catch (e) {
        return handleFirestoreError(res, e, "get-student-analytics");
      }
    }

    const logs = db.prepare(`
      SELECT type, score, max_score, timestamp 
      FROM performance_logs 
      WHERE user_id = ? 
      ORDER BY timestamp ASC
    `).all(userId);

    const attendance = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM attendance 
      WHERE user_id = ? 
      GROUP BY status
    `).all(userId);

    res.json({ logs, attendance });
  });

  app.delete("/api/questions/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    db.prepare("DELETE FROM questions WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Live Questions
  app.get("/api/live-questions", authenticate, async (req: any, res) => {
    const { classId } = req.query;
    if (firestore) {
      try {
        let qRef: any = firestore.collection('live_questions');
        if (classId) {
          qRef = qRef.where('class_id', '==', classId);
        }
        // Fetch and sort in memory to avoid composite index requirement
        const snap = await qRef.get();
        const questions = await Promise.all(snap.docs.map(async doc => {
          const data = doc.data();
          const uSnap = await firestore.collection('users').doc(data.student_id.toString()).get();
          const uData = uSnap.data();
          return {
            ...data,
            id: doc.id,
            student_name: `${uData?.name || ''} ${uData?.surname || ''}`.trim(),
            // Extract date for sorting
            created_at: data.created_at?.toDate() || new Date()
          };
        }));

        // Sort in memory
        questions.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

        return res.json(questions);
      } catch (e) {
        return handleFirestoreError(res, e, "get-live-questions");
      }
    }
    
    let questions;
    if (classId) {
      questions = db.prepare(`
        SELECT lq.*, (u.name || ' ' || COALESCE(u.surname, '')) as student_name 
        FROM live_questions lq 
        JOIN users u ON lq.student_id = u.id 
        ORDER BY lq.created_at DESC
      `).all();
    }
    res.json(questions);
  });

  app.post("/api/live-questions", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { content, classId, studentId } = req.body;
    
    if (!content) return res.status(400).json({ error: "Përmbajtja e pyetjes mungon" });

    if (firestore) {
      try {
        const teacherSnap = await firestore.collection('users').doc(req.user.id.toString()).get();
        const teacherData = teacherSnap.data();
        const teacherName = teacherData ? `${teacherData.name} ${teacherData.surname}` : 'Pedagogu';

        let targetStudent;
        if (studentId) {
          const uSnap = await firestore.collection('users').doc(studentId.toString()).get();
          if (!uSnap.exists) return res.status(400).json({ error: "Studenti nuk u gjet" });
          targetStudent = { id: uSnap.id, ...uSnap.data() };
        } else {
          let studentsSnap;
          if (classId) {
            studentsSnap = await firestore.collection('class_members')
              .where('class_id', '==', classId.toString())
              .where('status', '==', 'CONFIRMED')
              .get();
          } else {
            if (!teacherData?.program || !teacherData?.year || !teacherData?.group_name) {
              return res.status(400).json({ error: "Të dhënat e pedagogut janë të paplota (programi, viti ose grupi mungojnë)" });
            }
            studentsSnap = await firestore.collection('users')
              .where('role', '==', 'STUDENT')
              .where('program', '==', teacherData.program)
              .where('year', '==', teacherData.year)
              .where('group_name', '==', teacherData.group_name)
              .get();
          }

          if (!studentsSnap || studentsSnap.empty) return res.status(400).json({ error: "Nuk ka studentë të konfirmuar në klasë" });
          
          const randomIndex = Math.floor(Math.random() * studentsSnap.size);
          const studentDoc = studentsSnap.docs[randomIndex];
          if (classId) {
            const uSnap = await firestore.collection('users').doc(studentDoc.data().user_id.toString()).get();
            targetStudent = { id: uSnap.id, ...uSnap.data() };
          } else {
            targetStudent = { id: studentDoc.id, ...studentDoc.data() };
          }
        }

        const qRef = firestore.collection('live_questions').doc();
        const question = {
          id: qRef.id,
          teacher_id: req.user.id,
          teacher_name: teacherName,
          student_id: targetStudent.id.toString(),
          student_name: `${targetStudent.name} ${targetStudent.surname || ''}`,
          class_id: classId,
          content,
          status: 'PENDING',
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await qRef.set(question);
        
        // Auto-expire after 20 seconds
        setTimeout(async () => {
          try {
            const currentDoc = await firestore.collection('live_questions').doc(qRef.id).get();
            const currentData = currentDoc.data();
            if (currentData && currentData.status === 'PENDING') {
              await firestore.collection('live_questions').doc(qRef.id).update({ status: 'EXPIRED' });
              const updatedData = { ...currentData, status: 'EXPIRED' };
              if (currentData.class_id) {
                io.to(`class_${currentData.class_id}`).emit("live_question_update", updatedData);
              } else {
                io.emit("live_question_update", updatedData);
              }
            }
          } catch (err) { console.error(err); }
        }, 20000);

        if (classId) {
          io.to(`class_${classId}`).emit("new_live_question", question);
        } else {
          io.emit("new_live_question", question);
        }
        return res.json(question);
      } catch (e) {
        return handleFirestoreError(res, e, "create-live-question");
      }
    }

    // SQLite path
    let student;
    if (studentId) {
      student = db.prepare("SELECT id, name, surname FROM users WHERE id = ?").get(studentId) as any;
    } else if (classId) {
      student = db.prepare("SELECT u.id, u.name, u.surname FROM users u JOIN class_members cm ON u.id = cm.user_id WHERE cm.class_id = ? AND cm.status = 'CONFIRMED' ORDER BY RANDOM() LIMIT 1").get(classId) as any;
    } else {
      student = db.prepare("SELECT id, name, surname FROM users WHERE role = 'STUDENT' AND is_confirmed = 1 ORDER BY RANDOM() LIMIT 1").get() as any;
    }

    if (!student) return res.status(400).json({ error: "Studenti nuk u gjet" });

    const info = db.prepare("INSERT INTO live_questions (teacher_id, student_id, class_id, content) VALUES (?, ?, ?, ?)").run(req.user.id, student.id, classId, content);
    const question = {
      id: info.lastInsertRowid,
      content,
      teacher_id: req.user.id,
      student_id: student.id,
      student_name: `${student.name} ${student.surname || ''}`.trim(),
      class_id: classId,
      status: 'PENDING'
    };

    if (classId) {
      io.to(`class_${classId}`).emit("new_live_question", question);
    } else {
      io.emit("new_live_question", question);
    }

    setTimeout(() => {
      const current = db.prepare("SELECT * FROM live_questions WHERE id = ?").get(question.id) as any;
      if (current && current.status === 'PENDING') {
        db.prepare("UPDATE live_questions SET status = 'EXPIRED' WHERE id = ?").run(question.id);
        const updated = { ...current, status: 'EXPIRED' };
        if (current.class_id) io.to(`class_${current.class_id}`).emit("live_question_update", updated);
        else io.emit("live_question_update", updated);
      }
    }, 20000);

    res.json(question);
  });

  app.post("/api/classes/:classId/raise-hand", authenticate, async (req: any, res) => {
    const { classId } = req.params;
    if (req.user.role !== 'STUDENT') return res.status(403).json({ error: "Vetëm studentët mund të ngrenë dorën" });
    if (firestore) {
      try {
        const uSnap = await firestore.collection('users').doc(req.user.id.toString()).get();
        const u = uSnap.data();
        const raise = {
          user_id: req.user.id.toString(),
          name: `${u?.name} ${u?.surname || ''}`.trim(),
          photo: u?.profile_photo,
          class_id: classId.toString(),
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        };
        await firestore.collection('hand_raises').doc(`${classId}_${req.user.id.toString()}`).set(raise);
        io.to(`class_${classId}`).emit("student_raised_hand", raise);
        return res.json({ success: true });
      } catch (e) { return handleFirestoreError(res, e, "raise-hand"); }
    }
    db.prepare("CREATE TABLE IF NOT EXISTS hand_raises (class_id TEXT, user_id INTEGER, name TEXT, photo TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(class_id, user_id))").run();
    const user = db.prepare("SELECT name, surname, profile_photo FROM users WHERE id = ?").get(req.user.id) as any;
    db.prepare("INSERT OR REPLACE INTO hand_raises (class_id, user_id, name, photo) VALUES (?, ?, ?, ?)").run(classId, req.user.id, `${user.name} ${user.surname || ''}`.trim(), user.profile_photo);
    io.to(`class_${classId}`).emit("student_raised_hand", { user_id: req.user.id, name: `${user.name} ${user.surname || ''}`.trim(), photo: user.profile_photo, class_id: classId });
    res.json({ success: true });
  });

  app.get("/api/classes/:classId/hand-raises", authenticate, async (req: any, res) => {
    const { classId } = req.params;
    if (firestore) {
      try {
        const snap = await firestore.collection('hand_raises').where('class_id', '==', classId).get();
        return res.json(snap.docs.map(d => d.data()));
      } catch (e) { return handleFirestoreError(res, e, "get-hand-raises"); }
    }
    db.prepare("CREATE TABLE IF NOT EXISTS hand_raises (class_id TEXT, user_id INTEGER, name TEXT, photo TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(class_id, user_id))").run();
    res.json(db.prepare("SELECT * FROM hand_raises WHERE class_id = ? ORDER BY timestamp DESC").all(classId));
  });

  app.delete("/api/classes/:classId/hand-raises", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { classId } = req.params;
    if (firestore) {
      try {
        const snap = await firestore.collection('hand_raises').where('class_id', '==', classId).get();
        const b = firestore.batch();
        snap.docs.forEach(d => b.delete(d.ref));
        await b.commit();
        io.to(`class_${classId}`).emit("hand_raises_cleared");
        return res.json({ success: true });
      } catch (e) { return handleFirestoreError(res, e, "clear-hand-raises"); }
    }
    db.prepare("DELETE FROM hand_raises WHERE class_id = ?").run(classId);
    io.to(`class_${classId}`).emit("hand_raises_cleared");
    res.json({ success: true });
  });

  app.post("/api/live-questions/:id/confirm", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const qRef = firestore.collection('live_questions').doc(req.params.id);
        const doc = await qRef.get();
        const question = doc.data();
        if (question?.student_id !== req.user.id) return res.status(403).json({ error: "Pa autorizuar" });
        
        // CHECK TIMER
        const createdAt = question.created_at?.toDate() || new Date();
        const now = new Date();
        if (now.getTime() - createdAt.getTime() > 60000) { // 1 minute
          await qRef.update({ status: 'EXPIRED' });
          const updated = { ...question, status: 'EXPIRED' };
          io.emit("live_question_update", updated);
          return res.status(400).json({ error: "Koha mbaroi! Studenti nuk u përgjigj në kohë." });
        }

        await qRef.update({ status: 'CONFIRMED' });
        const updated = { ...question, status: 'CONFIRMED' };
        if (question?.class_id) {
          io.to(`class_${question.class_id}`).emit("live_question_update", updated);
        } else {
          io.emit("live_question_update", updated);
        }
        return res.json(updated);
      } catch (e) {
        return handleFirestoreError(res, e, "confirm-live-question");
      }
    }
    const question = db.prepare("SELECT * FROM live_questions WHERE id = ?").get(req.params.id) as any;
    if (!question) return res.status(404).json({ error: "Pyetja nuk u gjet" });
    if (question.student_id !== req.user.id) return res.status(403).json({ error: "Pa autorizuar" });
    
    // CHECK TIMER
    const createdAt = new Date(question.created_at.replace(' ', 'T') + 'Z');
    const now = new Date();
    if (now.getTime() - createdAt.getTime() > 60000) { // 1 minute
      db.prepare("UPDATE live_questions SET status = 'EXPIRED' WHERE id = ?").run(req.params.id);
      const updated = { ...question, status: 'EXPIRED' };
      io.emit("live_question_update", updated);
      return res.status(400).json({ error: "Koha mbaroi! Studenti nuk u përgjigj në kohë." });
    }

    db.prepare("UPDATE live_questions SET status = 'CONFIRMED' WHERE id = ?").run(req.params.id);
    const updated = { ...question, status: 'CONFIRMED' };
    if (question.class_id) {
       io.to(`class_${question.class_id}`).emit("live_question_update", updated);
    } else {
       io.emit("live_question_update", updated);
    }
    res.json(updated);
  });

  app.post("/api/live-questions/:id/answer", authenticate, async (req: any, res) => {
    const { answer } = req.body;
    if (firestore) {
      try {
        const qRef = firestore.collection('live_questions').doc(req.params.id);
        const doc = await qRef.get();
        const question = doc.data();
        if (question?.student_id !== req.user.id) return res.status(403).json({ error: "Pa autorizuar" });
        
        await qRef.update({ answer, status: 'ANSWERED' });
        const updated = { ...question, answer, status: 'ANSWERED' };
        io.emit("live_question_update", updated);
        return res.json(updated);
      } catch (e) {
        return handleFirestoreError(res, e, "answer-live-question");
      }
    }
    const question = db.prepare("SELECT * FROM live_questions WHERE id = ?").get(req.params.id) as any;
    if (question.student_id !== req.user.id) return res.status(403).json({ error: "Pa autorizuar" });
    
    db.prepare("UPDATE live_questions SET answer = ?, status = 'ANSWERED' WHERE id = ?").run(answer, req.params.id);
    const updated = { ...question, answer, status: 'ANSWERED' };
    io.emit("live_question_update", updated);
    res.json(updated);
  });

  app.post("/api/live-questions/:id/expire", authenticate, async (req: any, res) => {
    try {
      if (firestore) {
        const qRef = firestore.collection('live_questions').doc(req.params.id);
        const doc = await qRef.get();
        const question = doc.data();
        if (!question) return res.status(404).json({ error: "Pyetja nuk u gjet" });
        
        if (question.status === 'PENDING') {
          await qRef.update({ status: 'EXPIRED' });
          const updated = { ...question, status: 'EXPIRED' };
          if (question.class_id) {
            io.to(`class_${question.class_id}`).emit("live_question_update", updated);
          } else {
            io.emit("live_question_update", updated);
          }
          return res.json(updated);
        }
        return res.json(question);
      }
      const question = db.prepare("SELECT * FROM live_questions WHERE id = ?").get(req.params.id) as any;
      if (question && question.status === 'PENDING') {
        db.prepare("UPDATE live_questions SET status = 'EXPIRED' WHERE id = ?").run(req.params.id);
        const updated = { ...question, status: 'EXPIRED' };
        if (question.class_id) {
          io.to(`class_${question.class_id}`).emit("live_question_update", updated);
        } else {
          io.emit("live_question_update", updated);
        }
        return res.json(updated);
      }
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Gabim gjatë skadimit të pyetjes" });
    }
  });

  app.post("/api/live-questions/:id/grade", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { score } = req.body;
    
    if (firestore) {
      try {
        const qRef = firestore.collection('live_questions').doc(req.params.id);
        await qRef.update({ score, status: 'GRADED' });
        const doc = await qRef.get();
        const question = doc.data();
        
        if (question) {
          await firestore.collection('performance_logs').add({
            user_id: question.student_id,
            type: 'TEST',
            score,
            max_score: 100,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          io.emit("live_question_update", { ...question, score, status: 'GRADED' });
          io.to(`user_${question.student_id}`).emit("score_updated");
          io.to("teachers").emit("score_updated");
        }
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "grade-live-question");
      }
    }

    db.prepare("UPDATE live_questions SET score = ?, status = 'GRADED' WHERE id = ?").run(score, req.params.id);
    const question = db.prepare("SELECT * FROM live_questions WHERE id = ?").get(req.params.id) as any;
    
    // Log to performance
    db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score) VALUES (?, 'TEST', ?, 100)")
      .run(question.student_id, score);

    io.emit("live_question_update", { ...question, score, status: 'GRADED' });
    res.json({ success: true });
  });

  // Notifications
  app.post("/api/notifications/read-all", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const snap = await firestore.collection('notifications')
          .where('user_id', '==', req.user.id.toString())
          .where('is_read', '==', false)
          .get();
        
        const batch = firestore.batch();
        snap.docs.forEach(doc => {
          batch.update(doc.ref, { is_read: true });
        });
        await batch.commit();
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "read-all-notifications");
      }
    }
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(req.user.id);
    res.json({ success: true });
  });

  app.get("/api/notifications", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const snap = await firestore.collection('notifications')
          .where('user_id', '==', req.user.id.toString())
          .get();
        
        const notifications = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        
        // Sort in memory to avoid composite index requirement
        notifications.sort((a: any, b: any) => {
          const timeA = a.created_at?.seconds || 0;
          const timeB = b.created_at?.seconds || 0;
          return timeB - timeA; // Newest first
        });

        return res.json(notifications.slice(0, 20));
      } catch (e) {
        return handleFirestoreError(res, e, "get-notifications");
      }
    }
    const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
    res.json(notifications);
  });

  app.post("/api/teacher/rate-student", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { studentId, score, comment } = req.body;

    if (firestore) {
      try {
        await firestore.collection('performance_logs').add({
          user_id: studentId.toString(),
          type: 'RATING',
          score,
          max_score: 10,
          comment,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await firestore.collection('notifications').add({
          user_id: studentId.toString(),
          title: "Vlerësim i Ri",
          content: `Mësuesi ju ka vlerësuar me ${score}/10. Komenti: ${comment}`,
          type: 'GRADE',
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        io.to(`user_${studentId}`).emit("new_notification");
        io.to(`user_${studentId}`).emit("score_updated");
        io.to("teachers").emit("score_updated");
        
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "rate-student");
      }
    }

    db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score, comment) VALUES (?, ?, ?, ?, ?)")
      .run(studentId, 'RATING', score, 10, comment);
    
    await notifyUser(studentId, "Vlerësim i Ri", `Mësuesi ju ka vlerësuar me ${score}/10. Komenti: ${comment}`, 'GRADE');
    
    io.to(`user_${studentId}`).emit("score_updated");
    io.to("teachers").emit("score_updated");

    res.json({ success: true });
  });

  // Assignments
  app.get("/api/assignments", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        let assignments;
        if (req.user.role === 'TEACHER') {
          const snap = await firestore.collection('assignments').where('teacher_id', '==', req.user.id).get();
          assignments = await Promise.all(snap.docs.map(async doc => {
            const data = doc.data();
            const uSnap = await firestore.collection('users').doc(data.teacher_id.toString()).get();
            const subsSnap = await firestore.collection('submissions').where('assignment_id', '==', data.id).get();
            return { ...data, teacher_name: uSnap.data()?.name, submissions_count: subsSnap.size };
          }));
        } else {
          const snap = await firestore.collection('assignments')
            .where('status', '==', 'PUBLISHED')
            .get();

          const studentAssignments = snap.docs.map(doc => doc.data())
            .filter((a: any) => {
              const uP = (req.user.program || '').trim().toUpperCase();
              const uY = (req.user.year || '').trim().toUpperCase();
              const uG = (req.user.group_name || '').trim().toUpperCase();
              
              const aP = (a.program || '').trim().toUpperCase();
              const aY = (a.year || '').trim().toUpperCase();
              const aG = (a.group_name || '').trim().toUpperCase();
              
              return aP === uP && aY === uY && aG === uG;
            });

          assignments = await Promise.all(studentAssignments.map(async (data: any) => {
            const uSnap = await firestore.collection('users').doc(data.teacher_id.toString()).get();
            return { ...data, teacher_name: uSnap.data()?.name };
          }));
        }
        return res.json(assignments);
      } catch (e) {
        return handleFirestoreError(res, e, "get-assignments");
      }
    }
    let assignments;
    if (req.user.role === 'TEACHER') {
      assignments = db.prepare(`
        SELECT a.*, u.name as teacher_name,
        (SELECT COUNT(*) FROM submissions WHERE assignment_id = a.id) as submissions_count
        FROM assignments a 
        JOIN users u ON a.teacher_id = u.id
        WHERE a.teacher_id = ?
      `).all(req.user.id);
    } else {
      assignments = db.prepare(`
        SELECT a.*, u.name as teacher_name 
        FROM assignments a 
        JOIN users u ON a.teacher_id = u.id
        WHERE a.status = 'PUBLISHED' 
        AND TRIM(UPPER(a.program)) = TRIM(UPPER(?)) 
        AND TRIM(UPPER(a.year)) = TRIM(UPPER(?)) 
        AND TRIM(UPPER(a.group_name)) = TRIM(UPPER(?))
      `).all(req.user.program || '', req.user.year || '', req.user.group_name || '');
    }
    res.json(assignments);
  });

  app.post("/api/assignments", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të krijojnë detyra" });
    const { title, description, deadline, materials, maxPoints, submissionType, status, program, year, group_name } = req.body;
    
    if (firestore) {
      try {
        const assRef = firestore.collection('assignments').doc();
        const assId = assRef.id;
        await assRef.set({
          id: assId,
          title, description, deadline, materials,
          max_points: maxPoints || 100,
          submission_type: submissionType || 'BOTH',
          status: status || 'DRAFT',
          teacher_id: req.user.id,
          program, year, group_name,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        if (status === 'PUBLISHED') {
          io.emit("new_assignment", { id: assId, title, teacherName: req.user.name, program, year, group_name, assignmentId: assId });
          
          // Notifications
          const studentsSnap = await firestore.collection('users')
            .where('role', '==', 'STUDENT')
            .where('program', '==', program)
            .where('year', '==', year)
            .where('group_name', '==', group_name)
            .get();
          
          const batch = firestore.batch();
          studentsSnap.forEach(doc => {
            batch.set(firestore.collection('notifications').doc(), {
              user_id: doc.id,
              title: "Detyrë e Re: " + title,
              content: `Mësuesi ${req.user.name} ka caktuar një detyrë të re me afat ${deadline}.`,
              type: 'ASSIGNMENT',
              target_id: assId,
              target_type: 'ASSIGNMENT',
              created_at: admin.firestore.FieldValue.serverTimestamp()
            });
          });
          await batch.commit();
        }

        return res.json({ id: assId });
      } catch (e) {
        return handleFirestoreError(res, e, "create-assignment");
      }
    }

    const info = db.prepare("INSERT INTO assignments (title, description, deadline, materials, max_points, submission_type, status, teacher_id, program, year, group_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(title, description, deadline, materials, maxPoints || 100, submissionType || 'BOTH', status || 'DRAFT', req.user.id, program, year, group_name);
    
    if (status === 'PUBLISHED') {
      const assId = info.lastInsertRowid;
      io.emit("new_assignment", { id: assId, title, teacherName: req.user.name, program, year, group_name, assignmentId: assId });
      
      const students = db.prepare("SELECT id FROM users WHERE role = 'STUDENT' AND program = ? AND year = ? AND group_name = ?")
        .all(program, year, group_name) as any[];
      for (const s of students) {
        db.prepare("INSERT INTO notifications (user_id, title, content, type, target_id, target_type) VALUES (?, ?, ?, 'ASSIGNMENT', ?, 'ASSIGNMENT')")
          .run(s.id, "Detyrë e Re: " + title, `Mësuesi ${req.user.name} ka caktuar një detyrë të re me afat ${deadline}.`, info.lastInsertRowid);
      }
    }
    
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/assignments/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    try {
      db.prepare("DELETE FROM assignments WHERE id = ? AND teacher_id = ?").run(req.params.id, req.user.id);
      io.emit("assignment_deleted", { id: req.params.id });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Gabim gjatë fshirjes" }); }
  });

  app.patch("/api/assignments/:id/status", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të ndryshojnë statusin" });
    const { status } = req.body;
    
    if (firestore) {
      try {
        await firestore.collection('assignments').doc(req.params.id).update({ status });
        io.emit("assignment_updated", { id: req.params.id, status });
        if (status === 'PUBLISHED') {
          const assSnap = await firestore.collection('assignments').doc(req.params.id).get();
          const data = assSnap.data();
          io.emit("new_assignment", { 
            id: data?.id, 
            assignmentId: data?.id,
            title: data?.title, 
            teacherName: req.user.name, 
            program: data?.program, 
            year: data?.year, 
            group_name: data?.group_name 
          });
          
          if (data) {
            const studentsSnap = await firestore.collection('users')
              .where('role', '==', 'STUDENT')
              .where('program', '==', data.program)
              .where('year', '==', data.year)
              .where('group_name', '==', data.group_name)
              .get();
            
            const batch = firestore.batch();
            studentsSnap.forEach(doc => {
              batch.set(firestore.collection('notifications').doc(), {
                user_id: doc.id,
                title: "Detyrë u Publikua: " + data.title,
                content: `Detyra është gati për dorëzim.`,
                type: 'ASSIGNMENT',
                target_id: req.params.id,
                target_type: 'ASSIGNMENT',
                created_at: admin.firestore.FieldValue.serverTimestamp()
              });
            });
            await batch.commit();
          }
        }
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "update-assignment-status");
      }
    }

    db.prepare("UPDATE assignments SET status = ? WHERE id = ?").run(status, req.params.id);
    io.emit("assignment_updated", { id: req.params.id, status });
    
    if (status === 'PUBLISHED') {
      const ass = db.prepare("SELECT * FROM assignments WHERE id = ?").get(req.params.id) as any;
      io.emit("new_assignment", { 
        id: ass.id, 
        assignmentId: ass.id,
        title: ass.title, 
        teacherName: req.user.name, 
        program: ass.program, 
        year: ass.year, 
        group_name: ass.group_name 
      });
      
      const students = db.prepare("SELECT id FROM users WHERE role = 'STUDENT' AND program = ? AND year = ? AND group_name = ?")
        .all(ass.program, ass.year, ass.group_name) as any[];
      for (const s of students) {
        db.prepare("INSERT INTO notifications (user_id, title, content, type, target_id, target_type) VALUES (?, ?, ?, 'ASSIGNMENT', ?, 'ASSIGNMENT')")
          .run(s.id, "Detyrë u Publikua: " + ass.title, `Detyra është gati për dorëzim.`, req.params.id);
      }
    }
    
    res.json({ success: true });
  });

  app.post("/api/assignments/:id/submit", authenticate, upload.single('file'), async (req: any, res) => {
    if (req.user.role !== 'STUDENT') return res.status(403).json({ error: "Vetëm studentët mund të dorëzojnë detyra" });
    const { content } = req.body;
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (firestore) {
      try {
        const assSnap = await firestore.collection('assignments').doc(req.params.id).get();
        const assignment = assSnap.data();
        const isLate = assignment && new Date() > new Date(assignment.deadline) ? 1 : 0;

        const existingSubSnap = await firestore.collection('submissions')
          .where('assignment_id', '==', req.params.id)
          .where('student_id', '==', req.user.id)
          .get();
        
        if (!existingSubSnap.empty) {
          return res.status(400).json({ error: "Ju e keni dorëzuar këtë detyrë një herë." });
        }

        const subRef = firestore.collection('submissions').doc();
        await subRef.set({
          id: subRef.id,
          assignment_id: req.params.id,
          student_id: req.user.id,
          content: content || "",
          file_path: filePath,
          is_late: isLate,
          status: 'SUBMITTED',
          submitted_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Notify teacher
        if (assignment && assignment.teacher_id) {
          const studentSnap = await firestore.collection('users').doc(req.user.id.toString()).get();
          const student = studentSnap.data();
          await firestore.collection('notifications').add({
            user_id: assignment.teacher_id.toString(),
            title: "Dorëzim i Ri Detyre",
            content: `Studenti ${student?.name} ${student?.surname || ''} ka dorëzuar detyrën: ${assignment.title}`,
            type: 'ASSIGNMENT_SUBMISSION',
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
          io.to(`user_${assignment.teacher_id}`).emit("new_notification");
          
          io.to(`user_${assignment.teacher_id}`).emit("submission_updated", {
            type: 'NEW_SUBMISSION',
            studentName: `${student?.name} ${student?.surname || ''}`,
            assignmentTitle: assignment.title
          });
        }

        return res.json({ id: subRef.id });
      } catch (e) {
        return handleFirestoreError(res, e, "submit-assignment");
      }
    }

    const assignment = db.prepare("SELECT * FROM assignments WHERE id = ?").get(req.params.id) as any;
    const isLate = assignment && new Date() > new Date(assignment.deadline) ? 1 : 0;

    const existing = db.prepare("SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?").get(req.params.id, req.user.id);
    if (existing) {
      return res.status(400).json({ error: "Ju e keni dorëzuar këtë detyrë një herë." });
    }

    const info = db.prepare("INSERT INTO submissions (assignment_id, student_id, content, file_path, is_late, status) VALUES (?, ?, ?, ?, ?, 'SUBMITTED')")
      .run(req.params.id, req.user.id, content || "", filePath, isLate);
    
    // Notify teacher (SQLite)
    if (assignment && assignment.teacher_id) {
      const student = db.prepare("SELECT name, surname FROM users WHERE id = ?").get(req.user.id) as any;
      notifyUser(assignment.teacher_id, "Dorëzim i Ri Detyre", `Studenti ${student?.name} ${student?.surname || ''} ka dorëzuar detyrën: ${assignment.title}`, 'ASSIGNMENT_SUBMISSION', assignment.id, 'ASSIGNMENT');
      
      // Detailed real-time update for teacher
      io.to(`user_${assignment.teacher_id}`).emit("submission_updated", {
        type: 'NEW_SUBMISSION',
        studentName: `${student?.name} ${student?.surname || ''}`,
        assignmentTitle: assignment.title,
        targetId: assignment.id,
        targetType: 'ASSIGNMENT'
      });
    } else {
      io.emit("submission_updated");
    }
    
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/submissions/:id/undo", authenticate, async (req: any, res) => {
    if (req.user.role !== 'STUDENT') return res.status(403).json({ error: "Pa autorizuar" });

    if (firestore) {
      try {
        const subRef = firestore.collection('submissions').doc(req.params.id);
        const subSnap = await subRef.get();
        if (!subSnap.exists) return res.status(404).json({ error: "Dorëzimi nuk u gjet" });
        
        const data = subSnap.data() as any;
        if (data.student_id !== req.user.id) return res.status(403).json({ error: "Nuk mund të fshini dorëzimin e dikujt tjetër" });
        
        const submittedAt = data.submitted_at.toDate();
        const diff = (new Date().getTime() - submittedAt.getTime()) / 1000;
        
        if (diff > 120) return res.status(400).json({ error: "Koha për anulim ka skaduar (2 minuta)" });
        
        await subRef.delete();
        io.emit("submission_updated");
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "undo-submission");
      }
    }
    
    const sub = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id) as any;
    if (!sub) return res.status(404).json({ error: "Dorëzimi nuk u gjet" });
    if (sub.student_id !== req.user.id) return res.status(403).json({ error: "Nuk mund të fshini dorëzimin e dikujt tjetër" });
    
    const submittedAt = new Date(sub.submitted_at);
    const diff = (new Date().getTime() - submittedAt.getTime()) / 1000;
    
    if (diff > 120) return res.status(400).json({ error: "Koha për anulim ka skaduar (2 minuta)" });
    
    db.prepare("DELETE FROM submissions WHERE id = ?").run(req.params.id);
    io.emit("submission_updated");
    res.json({ success: true });
  });

  app.use("/uploads", express.static(uploadDir));

  // Chat
  app.get("/api/chat/messages", authenticate, async (req: any, res) => {
    const { type, receiverId, classId } = req.query;
    
    if (firestore) {
      try {
        if (type === 'PRIVATE') {
          if (!receiverId) return res.status(400).json({ error: "Duhet receiverId për bisedë private" });

          // Firestore doesn't support OR across multiple fields for (A=X AND B=Y) OR (A=Y AND B=X)
          // So we fetch both directions and merge
          const [sentSnap, receivedSnap] = await Promise.all([
            firestore.collection('messages')
              .where('chat_type', '==', 'PRIVATE')
              .where('sender_id', '==', req.user.id.toString())
              .where('receiver_id', '==', receiverId.toString())
              .get(),
            firestore.collection('messages')
              .where('chat_type', '==', 'PRIVATE')
              .where('sender_id', '==', receiverId.toString())
              .where('receiver_id', '==', req.user.id.toString())
              .get()
          ]);

          let messages = [...sentSnap.docs, ...receivedSnap.docs].map(doc => {
            const data = doc.data();
            let role = data.sender_role;
            let name = data.sender_name;
            
            if (!role && data.sender_id === req.user.id.toString()) {
              role = req.user.role;
              name = `${req.user.name} ${req.user.surname || ''}`.trim();
            }

            return {
              ...data,
              sender_name: name,
              sender_role: role,
              id: doc.id,
              timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : (data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000).toISOString() : data.timestamp)
            };
          });

          messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          return res.json(messages.slice(-100));
        }

        let query: any = firestore.collection('messages')
          .where('chat_type', '==', type || 'CLASS');

        if (type === 'CLASS') {
          if (classId) {
             query = query.where('class_id', '==', classId);
          } else {
            const userSnap = await firestore.collection('users').doc(req.user.id.toString()).get();
            if (userSnap.exists) {
              const user = userSnap.data();
              if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

              const classSnap = await firestore.collection('classes')
                .where('department', '==', user.program)
                .where('year', '==', user.year)
                .where('group_name', '==', user.group_name)
                .where('study_type', '==', user.study_type)
                .get();

              if (!classSnap.empty) {
                query = query.where('class_id', '==', classSnap.docs[0].id);
              }
            }
          }
        }

        const messagesSnap = await query.get();
        if (!messagesSnap.empty || type !== 'CLASS') {
          const messages = messagesSnap.docs.map((doc: any) => {
            const data = doc.data();
            let role = data.sender_role;
            let name = data.sender_name;
            
            // Fallback for current user's older messages
            if (!role && data.sender_id === req.user.id.toString()) {
              role = req.user.role;
              name = `${req.user.name} ${req.user.surname || ''}`.trim();
            }
            
            return {
              ...data,
              sender_name: name,
              sender_role: role,
              id: doc.id,
              timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : (data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000).toISOString() : data.timestamp)
            };
          });

          // Sort in memory to avoid composite index requirement
          messages.sort((a: any, b: any) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB; // Oldest first for chat display
          });

          return res.json(messages.slice(-100)); // Return last 100 messages
        }
      } catch (e) {
        console.error("Firestore Chat Error:", e);
      }
    }

    if (type === 'PRIVATE' && receiverId) {
      const messages = db.prepare(`
        SELECT m.*, u.name, u.surname, u.role, u.profile_photo as senderPhoto
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.timestamp ASC
      `).all(req.user.id, receiverId, receiverId, req.user.id) as any[];
      return res.json(messages.map(m => ({
        ...m,
        sender_name: `${m.name} ${m.surname || ''}`.trim(),
        sender_role: m.role
      })));
    }

    let queryStr = `
      SELECT m.*, u.name, u.surname, u.role, u.profile_photo as sender_photo
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      WHERE m.chat_type = ? 
      AND m.timestamp > datetime('now', '-12 hours')
    `;
    const params: any[] = [type || 'CLASS'];

    if (type === 'CLASS') {
      if (classId) {
        queryStr += " AND m.class_id = ?";
        params.push(classId);
      } else {
        const user = db.prepare("SELECT program, year, group_name, study_type FROM users WHERE id = ?").get(req.user.id) as any;
        if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });
        const classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
          .get(user.program, user.year, user.group_name, user.study_type) as any;
        
        if (classroom) {
          queryStr += " AND m.class_id = ?";
          params.push(classroom.id);
        } else {
          return res.json([]);
        }
      }
    }

    queryStr += " ORDER BY m.timestamp ASC";
    const messages = db.prepare(queryStr).all(...params) as any[];
    res.json(messages.map(m => ({
      ...m,
      sender_name: `${m.name} ${m.surname || ''}`.trim(),
      sender_role: m.role
    })));
  });

  app.get("/api/assignments/:id/submissions", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të shohin dorëzimet" });
    if (firestore) {
      try {
        const snap = await firestore.collection('submissions').where('assignment_id', '==', req.params.id).get();
        const submissions = await Promise.all(snap.docs.map(async doc => {
          const data = doc.data();
          const uSnap = await firestore.collection('users').doc(data.student_id.toString()).get();
          const userData = uSnap.data();
          return {
            ...data,
            id: doc.id,
            student_name: `${userData?.name || ''} ${userData?.surname || ''}`.trim() || "Përdorues i panjohur"
          };
        }));
        return res.json(submissions);
      } catch (e) {
        return handleFirestoreError(res, e, "get-assignment-submissions");
      }
    }
    const submissions = db.prepare(`
      SELECT s.*, (u.name || ' ' || COALESCE(u.surname, '')) as student_name 
      FROM submissions s 
      JOIN users u ON s.student_id = u.id 
      WHERE s.assignment_id = ?
    `).all(req.params.id);
    res.json(submissions);
  });

  app.post("/api/submissions/:id/grade", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të vlerësojnë" });
    const { points, feedback, grade } = req.body; // grade 4-10
    
    if (firestore) {
      try {
        const subRef = firestore.collection('submissions').doc(req.params.id);
        await subRef.update({
          points,
          grade,
          feedback,
          status: 'GRADED',
          graded_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        const subSnap = await subRef.get();
        const sub = subSnap.data();
        if (sub) {
          const assSnap = await firestore.collection('assignments').doc(sub.assignment_id.toString()).get();
          const assignment = assSnap.data();
          const teacherSnap = await firestore.collection('users').doc(assignment?.teacher_id.toString()).get();
          const teacher = teacherSnap.data();

          await firestore.collection('performance_logs').add({
            user_id: sub.student_id,
            type: 'ASSIGNMENT',
            score: grade,
            max_score: 10,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

          await firestore.collection('notifications').add({
            user_id: sub.student_id,
            title: "Vlerësim Detyre: " + assignment?.title,
            content: `Mësuesi ${teacher?.name} ju ka vlerësuar me notën ${grade}.`,
            type: 'GRADE',
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });

          io.to(`user_${sub.student_id}`).emit("new_notification");
          io.to(`user_${sub.student_id}`).emit("score_updated");
          io.to("teachers").emit("score_updated");
          
          io.to(`user_${sub.student_id}`).emit("submission_updated", {
            type: 'GRADE_RECEIVED',
            assignmentTitle: assignment?.title || 'Detyrë',
            grade,
            targetId: assignment?.id,
            targetType: 'ASSIGNMENT'
          });
        }
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "grade-submission");
      }
    }

    let sub: any = null;
    db.transaction(() => {
      db.prepare("UPDATE submissions SET points = ?, grade = ?, feedback = ?, status = 'GRADED', graded_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(points, grade, feedback, req.params.id);
      
      sub = db.prepare(`
        SELECT s.student_id, a.id as assignment_id, a.max_points, a.title, u.name as teacher_name
        FROM submissions s 
        JOIN assignments a ON s.assignment_id = a.id 
        JOIN users u ON a.teacher_id = u.id
        WHERE s.id = ?
      `).get(req.params.id) as any;

      if (sub) {
        // Log to performance using the 4-10 grade
        db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score) VALUES (?, 'ASSIGNMENT', ?, 10)")
          .run(sub.student_id, grade);
      }
    })();

    if (sub) {
      // Notify student
      await notifyUser(sub.student_id, "Vlerësim Detyre: " + sub.title, `Mësuesi ${sub.teacher_name} ju ka vlerësuar me notën ${grade}.`, 'GRADE', sub.assignment_id, 'ASSIGNMENT');
      
      io.to(`user_${sub.student_id}`).emit("score_updated");
      io.to("teachers").emit("score_updated");
    }
    
    io.emit("submission_updated");
    res.json({ success: true });
  });

  app.get("/api/my-submissions", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const snap = await firestore.collection('submissions').where('student_id', '==', req.user.id.toString()).get();
        const submissions = await Promise.all(snap.docs.map(async doc => {
          const data = doc.data();
          const assSnap = await firestore.collection('assignments').doc(data.assignment_id.toString()).get();
          return {
            ...data,
            id: doc.id,
            assignment_title: assSnap.data()?.title
          };
        }));
        return res.json(submissions);
      } catch (e) {
        return handleFirestoreError(res, e, "get-my-submissions");
      }
    }
    const submissions = db.prepare(`
      SELECT s.*, a.title as assignment_title 
      FROM submissions s 
      JOIN assignments a ON s.assignment_id = a.id 
      WHERE s.student_id = ?
    `).all(req.user.id);
    res.json(submissions);
  });

  // Digital Library
  app.get("/api/library/books", authenticate, async (req: any, res) => {
    const { classId: queryClassId } = req.query;
    
    if (firestore) {
      try {
        let query: any = firestore.collection('library_books');
        
        if (queryClassId && queryClassId !== 'ALL' && queryClassId !== 'GLOBAL') {
          query = query.where('class_id', '==', queryClassId.toString());
        }
        
        const booksSnap = await query.get();
        let books = [];
        for (const doc of booksSnap.docs) {
          const bookData = doc.data();
          const uploaderSnap = await firestore.collection('users').doc(bookData.uploader_id.toString()).get();
          const uploaderData = uploaderSnap.exists ? uploaderSnap.data() : null;
          
          books.push({
            ...bookData,
            uploader_name: uploaderData?.name || 'I panjohur',
            uploader_surname: uploaderData?.surname || '',
            uploader_role: uploaderData?.role || 'STUDENT'
          });
        }
        
        return res.json(books);
      } catch (e) {
        console.error("Firestore Library Error:", e);
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    
    try {
      let books;
      if (queryClassId && queryClassId !== 'ALL' && queryClassId !== 'GLOBAL') {
        books = db.prepare(`
          SELECT b.*, u.name as uploader_name, u.surname as uploader_surname, u.role as uploader_role
          FROM library_books b 
          JOIN users u ON b.uploader_id = u.id 
          WHERE b.class_id = ?
          ORDER BY b.created_at DESC
        `).all(queryClassId);
      } else {
        // Show everything for ALL or GLOBAL or missing classId
        books = db.prepare(`
          SELECT b.*, u.name as uploader_name, u.surname as uploader_surname, u.role as uploader_role
          FROM library_books b 
          JOIN users u ON b.uploader_id = u.id 
          ORDER BY b.created_at DESC
        `).all();
      }
      res.json(books);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Gabim i brendshëm" });
    }
  });

  app.delete("/api/library/books/:id", authenticate, async (req: any, res) => {
    const { id } = req.params;
    
    if (firestore) {
      try {
        const bookRef = firestore.collection('library_books').doc(id);
        const bookSnap = await bookRef.get();
        if (!bookSnap.exists) return res.status(404).json({ error: "Libri nuk u gjet" });
        
        const bookData = bookSnap.data() as any;
        
        // CHECK PERMISSIONS: Teacher, Uploader, or Class Admin
        let hasPermission = String(req.user.role).toUpperCase() === 'TEACHER' || 
                           String(bookData.uploader_id) === String(req.user.id);
        
        if (!hasPermission && bookData.class_id) {
          const memberSnap = await firestore.collection('class_members')
            .where('class_id', '==', String(bookData.class_id))
            .where('user_id', '==', String(req.user.id))
            .where('is_admin', '==', 1)
            .get();
          if (!memberSnap.empty) hasPermission = true;
        }

        if (!hasPermission) {
          return res.status(403).json({ error: "Nuk keni leje për të fshirë këtë libër" });
        }
        
        await bookRef.delete();
        return res.json({ success: true });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    
    try {
      const book = db.prepare("SELECT * FROM library_books WHERE id = ?").get(id) as any;
      if (!book) return res.status(404).json({ error: "Libri nuk u gjet" });
      
      let hasPermission = String(req.user.role).toUpperCase() === 'TEACHER' || 
                         String(book.uploader_id) === String(req.user.id);
      
      if (!hasPermission && book.class_id) {
        const adminCheck = db.prepare("SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ? AND is_admin = 1").get(book.class_id, req.user.id);
        if (adminCheck) hasPermission = true;
      }

      if (!hasPermission) {
        return res.status(403).json({ error: "Nuk keni leje për të fshirë këtë libër" });
      }
      
      db.prepare("DELETE FROM library_books WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Gabim i brendshëm" });
    }
  });

  app.post("/api/library/upload", authenticate, upload.single('file'), async (req: any, res) => {
    const { title, author, external_link, classId: bodyClassId } = req.body;
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!filePath && !external_link) return res.status(400).json({ error: "File ose link i kërkuar" });

    if (firestore) {
      try {
        const user = req.user;
        const memberSnap = await firestore.collection('class_members').where('user_id', '==', req.user.id).get();
        const member = memberSnap.empty ? null : memberSnap.docs[0].data();

        if (user.role !== 'TEACHER' && !member?.is_admin) {
          return res.status(403).json({ error: "Vetëm mësuesit dhe presidenti i klasës mund të publikojnë libra" });
        }

        let classId = bodyClassId;
        if (classId === 'GLOBAL' || classId === 'ALL') classId = null;
        
        if (!classId && user.role !== 'TEACHER') {
          // If not global and no ID, try to find for student
          const classSnap = await firestore.collection('classes')
            .where('department', '==', user.program)
            .where('year', '==', user.year)
            .where('group_name', '==', user.group_name)
            .where('study_type', '==', user.study_type)
            .get();
          if (!classSnap.empty) classId = classSnap.docs[0].id;
        }

        const bookRef = firestore.collection('library_books').doc();
        await bookRef.set({
          id: bookRef.id,
          title, author: author || "I panjohur",
          file_path: filePath,
          external_link: external_link || null,
          uploader_id: req.user.id,
          class_id: classId || "GLOBAL",
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ id: bookRef.id });
      } catch (e) {
        console.error("Firestore Library Upload Error:", e);
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    // Check if user is teacher or class admin
    const userInfo = db.prepare(`
      SELECT u.id, u.role, cm.is_admin as is_class_admin, u.program, u.year, u.group_name, u.study_type
      FROM users u
      LEFT JOIN class_members cm ON u.id = cm.user_id
      WHERE u.id = ?
    `).get(req.user.id) as any;

    if (!userInfo) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

    if (userInfo.role !== 'TEACHER' && !userInfo.is_class_admin) {
      return res.status(403).json({ error: "Vetëm mësuesit dhe presidenti i klasës mund të publikojnë libra" });
    }

    let classId = bodyClassId;
    if (classId === 'GLOBAL' || classId === 'ALL') classId = null;

    if (!classId && userInfo.role !== 'TEACHER') {
      const classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
        .get(userInfo.program, userInfo.year, userInfo.group_name, userInfo.study_type) as any;
      if (classroom) classId = classroom.id;
    }

    const info = db.prepare("INSERT INTO library_books (title, author, file_path, external_link, uploader_id, class_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run(title, author || "I panjohur", filePath, external_link || null, req.user.id, classId || null);
    
    res.json({ id: info.lastInsertRowid });
  });

  // Schedules
  app.get("/api/schedules", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        if (req.user.role === 'TEACHER') {
          const snap = await firestore.collection('schedules').where('teacher_id', '==', req.user.id.toString()).get();
          if (!snap.empty) {
            return res.json(snap.docs.map(doc => doc.data()));
          }
        } else {
          const userSnap = await firestore.collection('users').doc(req.user.id.toString()).get();
          if (userSnap.exists) {
            const user = userSnap.data();
            if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

            const snap = await firestore.collection('schedules')
              .where('program', '==', user.program)
              .where('year', '==', user.year)
              .where('group_name', '==', user.group_name)
              .get();
            return res.json(snap.docs.map(doc => doc.data()));
          }
        }
      } catch (e) {
        console.error("Firestore Schedule Error:", e);
      }
    }
    let schedules;
    if (req.user.role === 'TEACHER') {
      schedules = db.prepare("SELECT * FROM schedules WHERE teacher_id = ?").all(req.user.id);
    } else {
      // For students, filter by their program, year and group
      const user = db.prepare("SELECT program, year, group_name FROM users WHERE id = ?").get(req.user.id) as any;
      if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });
      schedules = db.prepare(`
        SELECT s.*, u.name as teacher_name 
        FROM schedules s 
        JOIN users u ON s.teacher_id = u.id 
        WHERE s.program = ? AND s.year = ? AND s.group_name = ?
      `).all(user.program, user.year, user.group_name);
    }
    res.json(schedules);
  });

  app.post("/api/schedules", authenticate, async (req: any, res) => {
    const { day_of_week, start_time, end_time, program, year, group_name, building, classroom, subject } = req.body;
    
    let isAuthorized = req.user.role === 'TEACHER';
    let classId = null;

    if (!isAuthorized) {
      // Check if user is admin of the class
      if (firestore) {
        try {
          const classSnap = await firestore.collection('classes')
            .where('admin_id', '==', req.user.id.toString())
            .where('department', '==', program)
            .where('year', '==', year)
            .where('group_name', '==', group_name)
            .get();
          if (!classSnap.empty) {
            isAuthorized = true;
            classId = classSnap.docs[0].id;
          }
        } catch (e) {
          console.error("Auth check firestore error:", e);
        }
      }
      if (!isAuthorized) {
        const classroomData = db.prepare("SELECT id FROM classes WHERE admin_id = ? AND department = ? AND year = ? AND group_name = ?").get(req.user.id, program, year, group_name) as any;
        if (classroomData) {
          isAuthorized = true;
          classId = classroomData.id;
        }
      }
    } else {
      // If teacher, find the class id
      if (firestore) {
        try {
          const classSnap = await firestore.collection('classes')
            .where('department', '==', program)
            .where('year', '==', year)
            .where('group_name', '==', group_name)
            .get();
          if (!classSnap.empty) classId = classSnap.docs[0].id;
        } catch (e) {
          console.error("Teacher class lookup error:", e);
        }
      }
      if (!classId) {
        // Auto-create class for teachers if it doesn't exist
        const newClassId = `class_${Math.random().toString(36).substr(2, 9)}`;
        const classData = {
          id: newClassId,
          name: `${program} - ${year} ${group_name || ''}`.trim(),
          code: `AUTO_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          department: program,
          year: year,
          group_name: group_name,
          teacher_id: req.user.id.toString(),
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        if (firestore) {
           await firestore.collection('classes').doc(newClassId).set(classData);
        } else {
           db.prepare("INSERT INTO classes (name, code, department, year, group_name, teacher_id) VALUES (?, ?, ?, ?, ?, ?)").run(
             classData.name, classData.code, classData.department, classData.year, classData.group_name, req.user.id
           );
           const row = db.prepare("SELECT id FROM classes WHERE code = ?").get(classData.code) as any;
           classId = row.id;
        }
        if (firestore) classId = newClassId;
      }
    }

    if (!isAuthorized) return res.status(403).json({ error: "Pa autorizuar" });
    
    if (firestore) {
      try {
        // Check for conflicts
        const snap = await firestore.collection('schedules')
          .where('day_of_week', '==', day_of_week)
          .get();
        
        /* 
        const hasConflict = snap.docs.some(doc => {
          const s = doc.data();
          // Check for class conflict (same program, year, group) OR teacher conflict (same teacher)
          const isSameClass = s.program === program && s.year === year && s.group_name === group_name;
          const isSameTeacher = s.teacher_id === req.user.id.toString();
          
          if (isSameClass || isSameTeacher) {
            // Check for time overlap
            return (start_time < s.end_time && end_time > s.start_time);
          }
          return false;
        });

        if (hasConflict) {
          console.warn(`[CONFLICT] Schedule conflict detected for ${req.user.name} on ${day_of_week} at ${start_time}-${end_time}`);
          return res.status(400).json({ error: "Ka një konflikt në orar për këtë kohë" });
        }
        */

        const schRef = firestore.collection('schedules').doc();
        const schedule = {
          id: schRef.id,
          teacher_id: req.user.id,
          teacher_name: req.user.name,
          class_id: classId ? classId.toString() : null,
          day_of_week, start_time, end_time,
          program, year, group_name,
          building, classroom, subject,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        await schRef.set(schedule);
        return res.json(schedule);
      } catch (e) {
        return handleFirestoreError(res, e, "create-schedule");
      }
    }

    // Check for conflicts
    /*
    const conflict = db.prepare(`
      SELECT * FROM schedules 
      WHERE day_of_week = ? 
      AND (
        (program = ? AND year = ? AND group_name = ?) -- Class conflict
        OR teacher_id = ? -- Teacher conflict
      )
      AND (
        (start_time < ? AND end_time > ?) -- Overlaps
      )
    `).get(day_of_week, program, year, group_name, req.user.id, end_time, start_time);

    if (conflict) {
      return res.status(400).json({ error: "Konflikt orari! Kjo klasë ose mësues ka një orë tjetër në këtë kohë." });
    }
    */

    const info = db.prepare(`
      INSERT INTO schedules (teacher_id, day_of_week, start_time, end_time, program, year, group_name, building, classroom, subject) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, day_of_week, start_time, end_time, program, year, group_name, building, classroom, subject);

    // Notify students
    try {
      if (firestore) {
        const studentsSnap = await firestore.collection('users')
          .where('role', '==', 'STUDENT')
          .where('program', '==', program)
          .where('year', '==', year)
          .get();
        
        const batch = firestore.batch();
        studentsSnap.docs.forEach(doc => {
          batch.set(firestore.collection('notifications').doc(), {
            user_id: doc.id,
            title: "Orar i Ri",
            content: `Mësuesi ${req.user.name} shtoi një orar të ri: ${day_of_week} ${start_time}-${end_time}`,
            type: 'CALENDAR',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            is_read: false
          });
        });
        await batch.commit();
      } else {
        const students = db.prepare("SELECT id FROM users WHERE role = 'STUDENT' AND program = ? AND year = ?").all(program, year) as any[];
        for (const s of students) {
          await notifyUser(s.id, "Orar i Ri", `Mësuesi ${req.user.name} shtoi një orar të ri: ${day_of_week} ${start_time}-${end_time}`, 'CALENDAR');
        }
      }
    } catch (e) {
      console.error("Notification Error:", e);
    }

    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/schedules/:id", authenticate, async (req: any, res) => {
    let isAuthorized = req.user.role === 'TEACHER';
    
    if (firestore) {
      try {
        const schRef = firestore.collection('schedules').doc(req.params.id);
        const doc = await schRef.get();
        if (!doc.exists) return res.status(404).json({ error: "Orari nuk u gjet" });
        
        const sched = doc.data();
        if (isAuthorized) {
          if (sched?.teacher_id !== req.user.id.toString()) isAuthorized = false;
        }

        if (!isAuthorized) {
          // Check if class admin
          const classSnap = await firestore.collection('classes')
            .where('admin_id', '==', req.user.id.toString())
            .where('department', '==', sched?.program)
            .where('year', '==', sched?.year)
            .where('group_name', '==', sched?.group_name)
            .get();
          if (!classSnap.empty) isAuthorized = true;
        }

        if (!isAuthorized) return res.status(403).json({ error: "Pa autorizuar" });
        
        await schRef.delete();
        io.emit("lecture_status_update");
        return res.json({ success: true });
      } catch (e) {
        return handleFirestoreError(res, e, "delete-schedule");
      }
    }

    const sched = db.prepare("SELECT * FROM schedules WHERE id = ?").get(req.params.id) as any;
    if (!sched) return res.status(404).json({ error: "Orari nuk u gjet" });

    if (isAuthorized) {
      if (sched.teacher_id !== req.user.id) isAuthorized = false;
    }

    if (!isAuthorized) {
      const classroom = db.prepare("SELECT id FROM classes WHERE admin_id = ? AND department = ? AND year = ? AND group_name = ?")
        .get(req.user.id, sched.program, sched.year, sched.group_name);
      if (classroom) isAuthorized = true;
    }

    if (!isAuthorized) return res.status(403).json({ error: "Pa autorizuar" });

    db.prepare("DELETE FROM schedules WHERE id = ?").run(req.params.id);
    io.emit("lecture_status_update");
    res.json({ success: true });
  });

  app.post("/api/chat/upload", authenticate, upload.single('file'), async (req: any, res) => {
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    if (!filePath) return res.status(400).json({ error: "File i kërkuar" });
    res.json({ url: filePath });
  });

  // Socket.io Logic
  const onlineUsers = new Map();

  function setupSocket() {
    io.on("connection", (socket) => {
    socket.on("join", (userData) => {
      // Ensure we have name and surname
      const user = db.prepare("SELECT name, surname FROM users WHERE id = ?").get(userData.id) as any;
      if (user) {
        userData.name = user.name;
        userData.surname = user.surname;
      }
      
      onlineUsers.set(socket.id, userData);
      
      // Join private room
      socket.join(`user_${userData.id}`);
      
      if (userData.role === 'TEACHER') {
        socket.join('teachers');
      }
      
      socket.on("join_class", (classId) => {
        if (classId) {
          socket.join(`class_${classId}`);
          console.log(`Socket ${socket.id} joined class_${classId}`);
        }
      });

      if (userData.role === 'STUDENT') {
        const user = db.prepare("SELECT program, year, group_name, study_type FROM users WHERE id = ?").get(userData.id) as any;
        if (user) {
          const classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
            .get(user.program, user.year, user.group_name, user.study_type) as any;
          
          if (classroom) {
            socket.join(`class_${classroom.id}`);
          }
        }
      }
      
      io.emit("user_status", Array.from(onlineUsers.values()));
    });

    // WebRTC Signaling for Screen Share / Live Stream
    socket.on("stream_started", (data) => {
      // data: { type: 'SCREEN' | 'CAMERA', classId: string }
      socket.to(`class_${data.classId}`).emit("stream_available", {
        teacherId: socket.id,
        type: data.type
      });
    });

    socket.on("check_stream", (data) => {
      // Sent by students when joining a class to see if anyone is broadcasting
      socket.to(`class_${data.classId}`).emit("is_stream_active", { requesterId: socket.id });
    });

    socket.on("stream_active_reply", (data) => {
      // Sent by teacher to a specific student responding to check_stream
      io.to(data.to).emit("stream_available", {
        teacherId: socket.id,
        type: data.type
      });
    });

    socket.on("stream_stopped", (data) => {
      socket.to(`class_${data.classId}`).emit("stream_ended");
    });

    socket.on("request_stream", (data) => {
      // data: { to: teacherSocketId }
      io.to(data.to).emit("student_requested_stream", { from: socket.id });
    });

    socket.on("webrtc_offer", (data) => {
      // data: { to: studentSocketId, offer: sdp }
      io.to(data.to).emit("webrtc_offer", { from: socket.id, offer: data.offer });
    });

    socket.on("webrtc_answer", (data) => {
      // data: { to: teacherSocketId, answer: sdp }
      io.to(data.to).emit("webrtc_answer", { from: socket.id, answer: data.answer });
    });

    socket.on("webrtc_ice_candidate", (data) => {
      // data: { to: targetSocketId, candidate: ice }
      io.to(data.to).emit("webrtc_ice_candidate", { from: socket.id, candidate: data.candidate });
    });

    socket.on("send_message", async (msg) => {
      let classId = null;
      let sender_name = "";
      let sender_role = "";

      if (firestore) {
        try {
          const sender_id_str = msg.senderId?.toString();
          if (!sender_id_str) return;
          const userSnap = await firestore.collection('users').doc(sender_id_str).get();
          const user = userSnap.data();
          if (user) {
            sender_name = `${user.name} ${user.surname || ''}`.trim();
            sender_role = user.role;
            
            // Priority: Use classId from message (e.g. from teacher's current classroom view)
            if (msg.classId) {
              classId = msg.classId;
            } else if (msg.chatType === 'CLASS') {
              const classSnap = await firestore.collection('classes')
                .where('department', '==', user.program)
                .where('year', '==', user.year)
                .where('group_name', '==', user.group_name)
                .where('study_type', '==', user.study_type)
                .get();
              if (!classSnap.empty) {
                classId = classSnap.docs[0].id;
              }
            }
          }
          
          const broadcastMsg = { 
            ...msg, 
            id: 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            clientSideId: msg.clientSideId || null,
            sender_name, 
            sender_role, 
            file_url: msg.fileUrl,
            file_name: msg.fileName,
            file_type: msg.fileType,
            timestamp: msg.timestamp || new Date().toISOString() 
          };

          if (msg.chatType === 'CLASS' && classId) {
            io.to(`class_${classId}`).emit("new_message", broadcastMsg);
          } else if (msg.chatType === 'PRIVATE' && msg.receiverId) {
            io.to(`user_${msg.receiverId}`).to(`user_${msg.senderId}`).emit("new_message", broadcastMsg);
          } else if (msg.chatType === 'TEACHER') {
            io.to('teachers').emit("new_message", broadcastMsg);
          } else if (msg.chatType === 'SCHOOL') {
             io.emit("new_message", broadcastMsg);
          } else {
            io.emit("new_message", broadcastMsg);
          }

          const msgData = {
            sender_id: msg.senderId.toString(),
            receiver_id: msg.receiverId ? msg.receiverId.toString() : null,
            content: msg.content,
            chat_type: msg.chatType || 'CLASS',
            class_id: classId ? classId.toString() : null,
            file_url: msg.fileUrl || null,
            file_name: msg.fileName || null,
            file_type: msg.fileType || null,
            sender_name: sender_name,
            sender_role: sender_role,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          };
          firestore.collection('messages').add(msgData).catch(e => console.error("Async Firestore Chat Error:", e));
          return;
        } catch (e) {
          console.error("Firestore Socket Error:", e);
        }
      }

      if (msg.chatType === 'CLASS') {
        const user = db.prepare("SELECT program, year, group_name, study_type, name, surname, role FROM users WHERE id = ?").get(msg.senderId) as any;
        if (user) {
          if (msg.classId) {
            classId = msg.classId;
          } else {
            const classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
              .get(user.program, user.year, user.group_name, user.study_type) as any;
            classId = classroom?.id;
          }
          msg.sender_name = `${user.name} ${user.surname || ''}`.trim();
          msg.sender_role = user.role;
        }
      } else {
        const user = db.prepare("SELECT name, surname, role FROM users WHERE id = ?").get(msg.senderId) as any;
        if (user) {
          msg.sender_name = `${user.name} ${user.surname || ''}`.trim();
          msg.sender_role = user.role;
        }
      }

      const broadcastMsg = {
        ...msg,
        id: 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        clientSideId: msg.clientSideId || null,
        sender_name: msg.sender_name,
        sender_role: msg.sender_role,
        class_id: classId,
        file_url: msg.fileUrl,
        file_name: msg.fileName,
        file_type: msg.fileType,
        timestamp: msg.timestamp || new Date().toISOString()
      };

      if (msg.chatType === 'CLASS' && classId) {
        io.to(`class_${classId}`).emit("new_message", broadcastMsg);
      } else if (msg.chatType === 'PRIVATE' && msg.receiverId) {
        io.to(`user_${msg.receiverId}`).to(`user_${msg.senderId}`).emit("new_message", broadcastMsg);
      } else if (msg.chatType === 'TEACHER') {
        io.to('teachers').emit("new_message", broadcastMsg);
      } else {
        io.emit("new_message", broadcastMsg);
      }

      db.prepare("INSERT INTO messages (sender_id, receiver_id, content, chat_type, class_id, file_url, file_name, file_type, sender_name, sender_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(msg.senderId, msg.receiverId || null, msg.content, msg.chatType || 'CLASS', classId, msg.fileUrl || null, msg.fileName || null, msg.fileType || null, msg.sender_name, msg.sender_role);
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      io.emit("user_status", Array.from(onlineUsers.values()));
    });
  });
}

// Initialize Socket.io
setupSocket();

// --- Frontend Setup ---
const distPath = path.join(_dirname, "dist");

// 2. Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("GLOBAL ERROR HANDLER:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ 
    error: "Gabim i brendshëm i serverit", 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// API Catch-all (for any /api/* routes that didn't match)
app.all(["/api", "/api/*"], (req, res) => {
  const method = req.method;
  const path = req.path;
  const url = req.url;
  
  console.error(`[API 404] ${method} ${url} (Path: ${path})`);
  
  res.status(404).json({ 
    error: "Rruga API nuk u gjet (404)", 
    details: `Metoda ${method} për rrugën ${path} nuk ekziston në server apo është e rezervuar.`,
    context: {
      method,
      url,
      path,
      isProduction: getIsProduction(),
      isNetlify: getIsNetlify(),
      isVercel: getIsVercel()
    },
    suggestion: "Ju lutem verifikoni URL-në dhe metodën HTTP përsëri."
  });
});

async function startApp() {
  console.log("startApp() is initializing...");
  
  // 3. Static Files or Vite Middleware (Conditional)
  if (getIsProduction() || getIsNetlify() || getIsVercel()) {
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    } else {
      console.warn("CRITICAL WARNING: Build artifacts (dist/) not found at:", distPath);
    }
  } else {
    console.log("Development mode detected. Initializing Vite middleware...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware initialized.");
    } catch (e: any) {
      console.error("Failed to initialize Vite middleware: " + e.message);
    }
  }

  // 4. SPA Catch-all (Serve index.html for all other routes)
  app.get("*", (req, res) => {
    // If it's an API request that somehow reached here, return JSON 404
    if (req.url.startsWith('/api') || req.path.startsWith('/api')) {
      console.log(`[SPA Fallback Blocked] API request reached SPA catch-all: ${req.method} ${req.url}`);
      return res.status(404).json({ 
        error: "Rruga API nuk u gjet (SPA Fallback)",
        method: req.method,
        url: req.url
      });
    }

    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send(`
        <html>
          <body style="font-family: sans-serif; padding: 2rem; line-height: 1.5;">
            <h1>Frontend Not Found</h1>
            <p>The server is running, but the frontend files (build) are missing.</p>
            <p>Please ensure you have run <code>npm run build</code> before starting the server.</p>
            <hr>
            <p>API Health Check: <a href="/api/health">/api/health</a></p>
          </body>
        </html>
      `);
    }
  });

  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Gabim i brendshëm i serverit", 
        details: err.message || String(err)
      });
    }
  });

  const PORT = 3000;
  await initDb();
  
  if (!getIsNetlify() && !getIsVercel()) {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is live and listening on port ${PORT}`);
    });

    // Real-time schedule updater - checks every minute and broadcasts current lecture to each class
    setInterval(() => {
      const now = new Date();
      const day = now.getDay();
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      try {
        const activeLectures1 = db.prepare(`
          SELECT ts.*, u.name as teacher_name, u.surname as teacher_surname, u.profile_photo as teacher_photo, c.name as class_name, ls.status
          FROM teacher_schedule ts
          JOIN users u ON ts.teacher_id = u.id
          JOIN classes c ON ts.class_id = c.id
          LEFT JOIN lecture_status ls ON ts.id = ls.schedule_id AND date(ls.updated_at) = date('now')
          WHERE ts.day_of_week = ? AND ts.start_time <= ? AND ts.end_time >= ?
        `).all(day, time, time) as any[];

        const dayName = ALBANIAN_DAYS[day];
        const activeLectures2 = db.prepare(`
          SELECT s.*, u.name as teacher_name, u.surname as teacher_surname, u.profile_photo as teacher_photo, 
                 c.id as class_id, c.name as class_name, ls.status
          FROM schedules s
          JOIN users u ON s.teacher_id = u.id
          JOIN classes c ON (s.program = c.department AND s.year = c.year AND (s.group_name = c.group_name OR s.group_name IS NULL OR c.group_name IS NULL))
          LEFT JOIN lecture_status ls ON s.id = ls.schedule_id AND date(ls.updated_at) = date('now')
          WHERE s.day_of_week = ? AND s.start_time <= ? AND s.end_time >= ?
        `).all(dayName, time, time) as any[];

        const allActive = [...activeLectures1, ...activeLectures2];

        allActive.forEach(lecture => {
          const payload = {
            ...lecture,
            teacher_name: `${lecture.teacher_name} ${lecture.teacher_surname || ''}`.trim(),
            updated_at: new Date().toISOString()
          };
          if (lecture.class_id) {
            io.to(`class_${lecture.class_id}`).emit("lecture_status_update", payload);
          }
          io.to(`user_${lecture.teacher_id}`).emit("lecture_status_update", payload);
        });
      } catch (e) {
        console.error("Background Schedule Broadcast Error:", e);
      }
    }, 60000);
  }
}

startApp().catch(e => {
  console.error("Failed to start application:", e);
});

export default app;
