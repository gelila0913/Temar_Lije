# Temar Lije - entity relationship diagram

> Reflects the deployed PostgreSQL schema (exported SQL, run locally by the
> team). Covers users, classrooms, coursework, attendance, and collaboration.

```mermaid
erDiagram
  USERS ||--o{ CLASSROOMS : creates
  USERS ||--o{ CLASSROOM_TEACHERS : teaches
  USERS ||--o{ CLASSROOM_MEMBERS : joins
  USERS ||--o{ ASSIGNMENT_SUBMISSIONS : submits
  USERS ||--o{ QUIZ_SUBMISSIONS : takes
  USERS ||--o{ ATTENDANCE_RECORDS : checks_in
  USERS ||--o{ MATERIALS : uploads
  USERS ||--o{ CHAT_MESSAGES : sends
  CLASSROOMS ||--o{ CLASSROOM_TEACHERS : has
  CLASSROOMS ||--o{ CLASSROOM_MEMBERS : has
  CLASSROOMS ||--o{ ASSIGNMENTS : contains
  CLASSROOMS ||--o{ QUIZZES : contains
  CLASSROOMS ||--o{ MATERIALS : contains
  CLASSROOMS ||--o{ ATTENDANCE_SESSIONS : contains
  CLASSROOMS ||--o{ STUDY_GROUPS : contains
  CLASSROOMS ||--o{ CHAT_MESSAGES : contains
  ASSIGNMENTS ||--o{ ASSIGNMENT_SUBMISSIONS : receives
  QUIZZES ||--o{ QUIZ_QUESTIONS : has
  QUIZZES ||--o{ QUIZ_SUBMISSIONS : receives
  ATTENDANCE_SESSIONS ||--o{ ATTENDANCE_RECORDS : has
  STUDY_GROUPS ||--o{ STUDY_GROUP_MEMBERS : has
  STUDY_GROUPS ||--o{ CHAT_MESSAGES : contains

  USERS {
    uuid id PK
    string email
    string role
  }
  CLASSROOMS {
    uuid id PK
    string title
    string invite_code
    uuid created_by_id FK
  }
  ASSIGNMENTS {
    uuid id PK
    string title
    uuid classroom_id FK
  }
  QUIZZES {
    uuid id PK
    string title
    boolean is_published
  }
  MATERIALS {
    uuid id PK
    string title
    string file_type
  }
  ATTENDANCE_SESSIONS {
    uuid id PK
    string session_code
  }
  STUDY_GROUPS {
    uuid id PK
    string name
  }
```
