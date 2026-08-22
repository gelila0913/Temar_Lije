const API_BASE_URL =
  import.meta.env?.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:3000'
    : '/api');

function getAuthHeaders(extraHeaders = {}) {
  const token = localStorage.getItem('temar_token');
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Helper to get full URL for uploaded static files (materials, submissions)
 */
export function getFileUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/uploads/')) {
    return cleanPath;
  }
  if (cleanPath.startsWith('/api/uploads/')) {
    return cleanPath.replace('/api', '');
  }
  return `/uploads${cleanPath}`;
}

// ---- CLASSROOMS API ----
export async function getClassrooms() {
  try {
    const res = await fetch(`${API_BASE_URL}/classrooms`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Failed to fetch classrooms:', err);
    return [];
  }
}

export async function createClassroom(payload) {
  const res = await fetch(`${API_BASE_URL}/classrooms`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to create classroom');
  }
  return await res.json();
}

export async function joinClassroom(code) {
  const res = await fetch(`${API_BASE_URL}/classrooms/join`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to join classroom');
  }
  return await res.json();
}

export async function getClassroomDetails(classId) {
  const res = await fetch(`${API_BASE_URL}/classrooms/${classId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to load classroom details');
  }
  return await res.json();
}

export async function deleteClassroom(classId) {
  const res = await fetch(`${API_BASE_URL}/classrooms/${classId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to delete classroom');
  }
  return await res.json();
}

// ---- MATERIALS API ----
export async function getMaterials(classId) {
  try {
    const res = await fetch(`${API_BASE_URL}/materials/class/${classId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const res2 = await fetch(`${API_BASE_URL}/classrooms/${classId}/materials`, {
        headers: getAuthHeaders(),
      });
      if (!res2.ok) return [];
      const data2 = await res2.json();
      return Array.isArray(data2) ? data2 : [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Failed to fetch materials:', err);
    return [];
  }
}

export async function getClassroomMembers(classId) {
  try {
    const res = await fetch(`${API_BASE_URL}/classrooms/${classId}/members`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { classroomId: classId, teachers: [], students: [], members: [] };
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch classroom members:', err);
    return { classroomId: classId, teachers: [], students: [], members: [] };
  }
}

export async function addClassroomMember(classId, studentIdOrEmail) {
  const res = await fetch(`${API_BASE_URL}/classrooms/${classId}/members`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ studentId: studentIdOrEmail }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to add classroom member');
  }
  return res.json();
}

export async function removeClassroomMember(classId, memberId) {
  const res = await fetch(`${API_BASE_URL}/classrooms/${classId}/members/${memberId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to remove member');
  return await res.json();
}

export async function uploadMaterial(formData) {
  let res = await fetch(`${API_BASE_URL}/materials/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    res = await fetch(`${API_BASE_URL}/materials`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to upload material');
  }
  return res.json();
}

// ---- ASSIGNMENTS API ----
export async function getAssignments(classId) {
  const res = await fetch(`${API_BASE_URL}/assignments/class/${classId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch assignments');
  return res.json();
}

export async function createAssignment(assignmentData) {
  const res = await fetch(`${API_BASE_URL}/assignments/create`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(assignmentData),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to create assignment');
  }
  return res.json();
}

export async function submitAssignment(assignmentId, formData) {
  const res = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/submit`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to submit assignment');
  }
  return res.json();
}

export async function getSubmissions(assignmentId) {
  const res = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/submissions`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch submissions');
  return res.json();
}

export async function deleteAssignment(assignmentId) {
  let res = await fetch(`${API_BASE_URL}/assignments/${assignmentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    res = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/delete`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  }
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to delete assignment');
  }
  return res.json();
}

// ---- ATTENDANCE API ----
export async function createAttendanceSession(classId, topic) {
  const res = await fetch(`${API_BASE_URL}/attendance/session`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ classId, topic }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to create attendance session');
  }
  return res.json();
}

export async function recordCheckIn(classId, studentId) {
  const res = await fetch(`${API_BASE_URL}/attendance/check-in`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ classId, studentId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Check-in failed');
  }
  return res.json();
}

export async function getAttendanceReport(classId) {
  try {
    let res = await fetch(`${API_BASE_URL}/attendance/${classId}/report`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      res = await fetch(`${API_BASE_URL}/attendance/class/${classId}/report`, {
        headers: getAuthHeaders(),
      });
    }
    if (!res.ok) {
      return {
        summary: { totalEnrolled: 0, PRESENT: 0, LATE: 0, ABSENT: 0 },
        records: { PRESENT: [], LATE: [], ABSENT: [] },
      };
    }
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch attendance report:', err);
    return {
      summary: { totalEnrolled: 0, PRESENT: 0, LATE: 0, ABSENT: 0 },
      records: { PRESENT: [], LATE: [], ABSENT: [] },
    };
  }
}

// ---- LIVE CLASS API ----
export async function startLiveSession(classId) {
  const res = await fetch(`${API_BASE_URL}/live-class/start`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ classId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to start live session');
  }
  return res.json();
}

export async function endLiveSession(classId) {
  const res = await fetch(`${API_BASE_URL}/live-class/end`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ classId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to end live session');
  }
  return res.json();
}

export async function getLiveToken(classId, userId, role = 'STUDENT') {
  const res = await fetch(
    `${API_BASE_URL}/live-class/${classId}/token?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}`,
    {
      headers: getAuthHeaders(),
    }
  );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to get session token');
  }
  return res.json();
}

// ---- QUIZZES API ----
export async function getQuizzes(classId) {
  try {
    let res = await fetch(`${API_BASE_URL}/classrooms/${classId}/quizzes`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      res = await fetch(`${API_BASE_URL}/quizzes/class/${classId}`, {
        headers: getAuthHeaders(),
      });
    }
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch quizzes:', err);
    return [];
  }
}

export async function generateAIQuiz(params) {
  const res = await fetch(`${API_BASE_URL}/quizzes/generate-ai`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to generate AI quiz');
  }
  return res.json();
}

export async function createQuiz(classId, quizPayload) {
  let res = await fetch(`${API_BASE_URL}/classrooms/${classId}/quizzes`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(quizPayload),
  });
  if (!res.ok) {
    res = await fetch(`${API_BASE_URL}/quizzes/create`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...quizPayload, classId }),
    });
  }
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to create quiz');
  }
  return res.json();
}

export async function publishQuiz(quizId) {
  const res = await fetch(`${API_BASE_URL}/quizzes/${quizId}/publish`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to publish quiz');
  }
  return res.json();
}

export async function getQuizDetails(quizId) {
  const res = await fetch(`${API_BASE_URL}/quizzes/${quizId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch quiz details');
  }
  return res.json();
}

export async function submitQuiz(quizId, answersPayload) {
  const res = await fetch(`${API_BASE_URL}/quizzes/${quizId}/submit`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(answersPayload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to submit quiz');
  }
  return res.json();
}

export async function getSubmissionResult(quizId) {
  const res = await fetch(`${API_BASE_URL}/quizzes/${quizId}/result`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch submission result');
  }
  return res.json();
}

export async function getQuizAnalytics(quizId) {
  const res = await fetch(`${API_BASE_URL}/quizzes/${quizId}/analytics`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch quiz analytics');
  }
  return res.json();
}

export async function deleteQuiz(quizId) {
  let res = await fetch(`${API_BASE_URL}/quizzes/${quizId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    res = await fetch(`${API_BASE_URL}/quizzes/${quizId}/delete`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  }
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to delete quiz');
  }
  return res.json();
}

