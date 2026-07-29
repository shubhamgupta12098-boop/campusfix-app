const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string;

const authBase = 'https://identitytoolkit.googleapis.com/v1';
const firestoreBase =
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

export interface FirebaseUser {
  uid: string;
  email: string;
  displayName?: string;
  idToken: string;
  refreshToken: string;
  emailVerified?: boolean;
}

const STORAGE_KEY = 'campusfix_firebase_session';

export const getStoredUser = (): FirebaseUser | null => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
};

export const storeUser = (user: FirebaseUser | null) => {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
};

async function authRequest(
  path: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`${authBase}/${path}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      json?.error?.message || 'Authentication request failed'
    );
  }

  return json;
}


// Changes the password for the currently signed-in user (from the Profile screen).
// Returns fresh tokens since Firebase rotates them whenever the password changes.
export async function updatePassword(
  idToken: string,
  newPassword: string
): Promise<{ idToken: string; refreshToken: string }> {
  const json = await authRequest('accounts:update', {
    idToken,
    password: newPassword,
    returnSecureToken: true,
  });
  return { idToken: json.idToken, refreshToken: json.refreshToken };
}

async function getAccountInfo(idToken: string) {
  const result = await authRequest('accounts:lookup', { idToken });
  return result?.users?.[0] || null;
}

export async function signInEmail(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const j = await authRequest('accounts:signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  });

  const account = await getAccountInfo(j.idToken);
  const user: FirebaseUser = {
    uid: j.localId,
    email: j.email,
    displayName: j.displayName,
    idToken: j.idToken,
    refreshToken: j.refreshToken,
    emailVerified: Boolean(account?.emailVerified),
  };

  storeUser(user);

  return user;
}

export async function signUpEmail(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  const j = await authRequest('accounts:signUp', {
    email,
    password,
    returnSecureToken: true,
  });

  const updated = await authRequest('accounts:update', {
    idToken: j.idToken,
    displayName,
    returnSecureToken: true,
  });

  const user: FirebaseUser = {
    uid: j.localId,
    email: j.email,
    displayName,
    idToken: updated.idToken || j.idToken,
    refreshToken: updated.refreshToken || j.refreshToken,
  };

  storeUser(user);

  return user;
}

export async function refreshUser(
  user: FirebaseUser
): Promise<FirebaseUser> {
  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.refreshToken,
      }),
    }
  );

  const j = await res.json();

  if (!res.ok) {
    throw new Error(j?.error?.message || 'Session expired');
  }

  return {
    ...user,
    uid: j.user_id,
    idToken: j.id_token,
    refreshToken: j.refresh_token,
  };
}

export function toFirestoreValue(value: any): any {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(toFirestoreValue),
      },
    };
  }

  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [
            key,
            toFirestoreValue(item),
          ])
        ),
      },
    };
  }

  return {
    stringValue: String(value),
  };
}

export function fromFirestoreValue(value: any): any {
  if (!value) {
    return null;
  }

  if ('nullValue' in value) {
    return null;
  }

  if ('stringValue' in value) {
    return value.stringValue;
  }

  if ('booleanValue' in value) {
    return value.booleanValue;
  }

  if ('integerValue' in value) {
    return Number(value.integerValue);
  }

  if ('doubleValue' in value) {
    return Number(value.doubleValue);
  }

  if ('timestampValue' in value) {
    return value.timestampValue;
  }

  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }

  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(
        ([key, item]) => [key, fromFirestoreValue(item)]
      )
    );
  }

  return null;
}

export const decodeDoc = (document: any) => ({
  id: document.name.split('/').pop(),
  ...Object.fromEntries(
    Object.entries(document.fields || {}).map(([key, value]) => [
      key,
      fromFirestoreValue(value),
    ])
  ),
});

async function token(forceRefresh = false): Promise<string> {
  let user = getStoredUser();

  if (!user) {
    throw new Error('You must be signed in.');
  }

  if (forceRefresh) {
    user = await refreshUser(user);
    storeUser(user);
  }

  return user.idToken;
}

export async function firestoreFetch(
  path: string,
  init: RequestInit = {}
) {
  let idToken = await token();

  const makeRequest = (currentToken: string) =>
    fetch(`${firestoreBase}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
        ...(init.headers || {}),
      },
    });

  let res = await makeRequest(idToken);

  if (res.status === 401) {
    idToken = await token(true);
    res = await makeRequest(idToken);
  }

  const text = await res.text();

  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!res.ok) {
    throw new Error(
      json?.error?.message || `Firestore error ${res.status}`
    );
  }

  return json;
}

export const encodeFields = (
  object: Record<string, any>
) => ({
  fields: Object.fromEntries(
    Object.entries(object)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        toFirestoreValue(value),
      ])
  ),
});