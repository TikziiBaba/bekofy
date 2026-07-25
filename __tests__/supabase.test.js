const vm = require('vm');
const fs = require('fs');
const path = require('path');

function loadSupabaseModule(overrides = {}) {
  const code = fs.readFileSync(
    path.resolve(__dirname, '../src/js/supabase.js'),
    'utf8'
  );

  const mockSupabaseClient = {
    auth: {
      signUp: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1', identities: [{ id: '1' }] } },
        error: null,
      }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      signInWithOAuth: jest.fn().mockResolvedValue({ data: {}, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: {} } }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    })),
    storage: {
      from: jest.fn(() => ({
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })),
        upload: jest.fn(),
        list: jest.fn(),
        remove: jest.fn(),
      })),
    },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
  };

  const sandbox = vm.createContext({
    console,
    setTimeout: (fn) => fn(),
    supabase: {
      createClient: jest.fn(() => mockSupabaseClient),
    },
    APP_CONFIG: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-key',
    },
    getArtistProfiles: jest.fn().mockResolvedValue({ data: [] }),
    fetch: jest.fn(),
    ...overrides,
  });

  vm.runInContext(code, sandbox);

  return { sandbox, mockSupabaseClient };
}

describe('getSupabase', () => {
  test('creates client with createClient on first call', () => {
    const { sandbox, mockSupabaseClient } = loadSupabaseModule();
    const client = sandbox.getSupabase();
    expect(client).toBe(mockSupabaseClient);
  });

  test('returns same client on subsequent calls', () => {
    const { sandbox } = loadSupabaseModule();
    const first = sandbox.getSupabase();
    const second = sandbox.getSupabase();
    expect(first).toBe(second);
  });
});

describe('signUpWithEmail', () => {
  test('creates user and inserts profile on success', async () => {
    const { sandbox, mockSupabaseClient } = loadSupabaseModule();
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { user: { id: 'user-123', identities: [{ id: '1' }] } },
      error: null,
    });

    const result = await sandbox.signUpWithEmail('test@test.com', 'pass123', 'testuser');

    expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'pass123',
      options: { data: { username: 'testuser' } },
    });
    expect(result.data.user.id).toBe('user-123');
  });

  test('detects duplicate email (empty identities)', async () => {
    const { sandbox, mockSupabaseClient } = loadSupabaseModule();
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { user: { id: 'user-1', identities: [] } },
      error: null,
    });

    const result = await sandbox.signUpWithEmail('taken@test.com', 'pass', 'user');
    expect(result.error.message).toBe('Bu e-posta adresi zaten kullan\u0131mda.');
  });

  test('returns error on auth failure', async () => {
    const { sandbox, mockSupabaseClient } = loadSupabaseModule();
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: null,
      error: { message: 'Invalid email', status: 400 },
    });

    const result = await sandbox.signUpWithEmail('bad', 'pass', 'user');
    expect(result.error.message).toBe('Invalid email');
  });

  test('inserts profile row after successful signup', async () => {
    const { sandbox, mockSupabaseClient } = loadSupabaseModule();
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { user: { id: 'new-user', identities: [{ id: '1' }] } },
      error: null,
    });
    const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseClient.from.mockReturnValue({ insert: mockInsert });

    await sandbox.signUpWithEmail('new@test.com', 'pass', 'newuser');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    expect(mockInsert).toHaveBeenCalledWith({ id: 'new-user', username: 'newuser' });
  });
});
