/**
 * Unit tests for authentication store and login functionality.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../../src/stores/auth'
import axios from 'axios'

// Mock axios
vi.mock('axios')
const mockedAxios = axios as { post: ReturnType<typeof vi.fn> }

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    }
  }
})()

// Set up localStorage mock
global.localStorage = localStorageMock as Storage

describe('Auth Store', () => {
  beforeEach(() => {
    // Create a fresh pinia instance for each test
    setActivePinia(createPinia())

    // Clear localStorage
    localStorage.clear()

    // Reset mocks
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have null tokens initially', () => {
      const authStore = useAuthStore()

      expect(authStore.accessToken).toBeNull()
      expect(authStore.refreshToken).toBeNull()
      expect(authStore.user).toBeNull()
    })

    it('should detect test mode from environment', () => {
      const authStore = useAuthStore()

      // In test environment, VITE_TEST_MODE should be true
      expect(authStore.isTestMode).toBe(true)
    })

    it('should not be authenticated initially', () => {
      const authStore = useAuthStore()

      expect(authStore.isAuthenticated).toBe(false)
    })

    it('should have isSpotifyUser as true by default', () => {
      const authStore = useAuthStore()

      expect(authStore.isSpotifyUser).toBe(true)
    })
  })

  describe('setTokens', () => {
    it('should set tokens in store and localStorage', () => {
      const authStore = useAuthStore()

      authStore.setTokens('test-access', 'test-refresh')

      expect(authStore.accessToken).toBe('test-access')
      expect(authStore.refreshToken).toBe('test-refresh')
      expect(localStorage.getItem('access_token')).toBe('test-access')
      expect(localStorage.getItem('refresh_token')).toBe('test-refresh')
    })
  })

  describe('setUser', () => {
    it('should set user in store and localStorage', () => {
      const authStore = useAuthStore()

      const user = {
        id: 'test-user-123',
        displayName: 'Groovy Dancer',
        email: 'test@disco.test'
      }

      authStore.setUser(user)

      expect(authStore.user).toEqual(user)
      expect(localStorage.getItem('user')).toBe(JSON.stringify(user))
    })
  })

  describe('clearTokens', () => {
    it('should clear tokens and user from store and localStorage', () => {
      const authStore = useAuthStore()

      // Set some data first
      authStore.setTokens('access', 'refresh')
      authStore.setUser({
        id: 'test-123',
        displayName: 'Test User',
        email: 'test@test.com'
      })

      // Clear it
      authStore.clearTokens()

      expect(authStore.accessToken).toBeNull()
      expect(authStore.refreshToken).toBeNull()
      expect(authStore.user).toBeNull()
      expect(localStorage.getItem('access_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()
    })

    it('should reset isSpotifyUser to true', () => {
      const authStore = useAuthStore()

      // Simulate manual login state
      authStore.isSpotifyUser = false
      localStorage.setItem('is_spotify_user', 'false')

      // Clear tokens
      authStore.clearTokens()

      expect(authStore.isSpotifyUser).toBe(true)
      expect(localStorage.getItem('is_spotify_user')).toBeNull()
    })
  })

  describe('loadFromStorage', () => {
    it('should load tokens and user from localStorage', () => {
      // Set data in localStorage
      localStorage.setItem('access_token', 'stored-access')
      localStorage.setItem('refresh_token', 'stored-refresh')
      localStorage.setItem('user', JSON.stringify({
        id: 'stored-123',
        displayName: 'Stored User',
        email: 'stored@test.com'
      }))

      const authStore = useAuthStore()
      authStore.loadFromStorage()

      expect(authStore.accessToken).toBe('stored-access')
      expect(authStore.refreshToken).toBe('stored-refresh')
      expect(authStore.user?.displayName).toBe('Stored User')
    })

    it('should handle missing localStorage data gracefully', () => {
      const authStore = useAuthStore()
      authStore.loadFromStorage()

      expect(authStore.accessToken).toBeNull()
      expect(authStore.refreshToken).toBeNull()
      expect(authStore.user).toBeNull()
    })

    it('should handle invalid JSON in user storage', () => {
      localStorage.setItem('user', 'invalid-json')

      const authStore = useAuthStore()
      authStore.loadFromStorage()

      expect(authStore.user).toBeNull()
    })

    it('should restore isSpotifyUser as false when stored', () => {
      localStorage.setItem('access_token', 'token')
      localStorage.setItem('refresh_token', 'refresh')
      localStorage.setItem('is_spotify_user', 'false')

      const authStore = useAuthStore()
      authStore.loadFromStorage()

      expect(authStore.isSpotifyUser).toBe(false)
    })

    it('should default isSpotifyUser to true when not stored', () => {
      localStorage.setItem('access_token', 'token')
      localStorage.setItem('refresh_token', 'refresh')

      const authStore = useAuthStore()
      authStore.loadFromStorage()

      expect(authStore.isSpotifyUser).toBe(true)
    })
  })

  describe('testLogin', () => {
    it('should successfully create a test user', async () => {
      const mockResponse = {
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user_id: 'test-user-abc123',
          display_name: 'Groovy Dancer',
          email: 'test-user-abc123@disco.test'
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const authStore = useAuthStore()
      const result = await authStore.testLogin()

      expect(result.success).toBe(true)
      expect(authStore.accessToken).toBe('mock-access-token')
      expect(authStore.refreshToken).toBe('mock-refresh-token')
      expect(authStore.user?.displayName).toBe('Groovy Dancer')
      expect(authStore.user?.id).toBe('test-user-abc123')
      expect(authStore.user?.email).toBe('test-user-abc123@disco.test')
    })

    it('should handle API errors gracefully', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'))

      const authStore = useAuthStore()
      const result = await authStore.testLogin()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(authStore.accessToken).toBeNull()
    })

    it('should handle 403 Forbidden (test mode disabled)', async () => {
      const mockError = {
        response: {
          status: 403,
          data: {
            detail: 'Test login is only available in test/debug mode'
          }
        }
      }

      mockedAxios.post.mockRejectedValue(mockError)

      const authStore = useAuthStore()
      const result = await authStore.testLogin()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Test login is only available')
    })

    it('should call the correct API endpoint', async () => {
      const mockResponse = {
        data: {
          access_token: 'token',
          refresh_token: 'refresh',
          user_id: 'id',
          display_name: 'Name',
          email: 'email@test.com'
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const authStore = useAuthStore()
      await authStore.testLogin()

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/test-login')
      )
    })

    it('should store tokens in localStorage', async () => {
      const mockResponse = {
        data: {
          access_token: 'stored-access',
          refresh_token: 'stored-refresh',
          user_id: 'user-123',
          display_name: 'Test User',
          email: 'test@test.com'
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const authStore = useAuthStore()
      await authStore.testLogin()

      expect(localStorage.getItem('access_token')).toBe('stored-access')
      expect(localStorage.getItem('refresh_token')).toBe('stored-refresh')
      expect(JSON.parse(localStorage.getItem('user') || '{}')).toEqual({
        id: 'user-123',
        displayName: 'Test User',
        email: 'test@test.com'
      })
    })
  })

  describe('manualLogin', () => {
    it('should successfully create a guest user', async () => {
      const mockResponse = {
        data: {
          access_token: 'manual_token_abc123',
          refresh_token: 'manual_refresh_abc123',
          user_id: 'manual_user123',
          display_name: 'Test Guest',
          email: '',
          is_spotify_user: 'false'
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const authStore = useAuthStore()
      const result = await authStore.manualLogin('Test Guest')

      expect(result.success).toBe(true)
      expect(authStore.accessToken).toBe('manual_token_abc123')
      expect(authStore.refreshToken).toBe('manual_refresh_abc123')
      expect(authStore.user?.displayName).toBe('Test Guest')
      expect(authStore.user?.id).toBe('manual_user123')
    })

    it('should set isSpotifyUser to false', async () => {
      const mockResponse = {
        data: {
          access_token: 'token',
          refresh_token: 'refresh',
          user_id: 'id',
          display_name: 'Guest',
          email: '',
          is_spotify_user: 'false'
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const authStore = useAuthStore()
      expect(authStore.isSpotifyUser).toBe(true) // Default

      await authStore.manualLogin('Guest')

      expect(authStore.isSpotifyUser).toBe(false)
      expect(localStorage.getItem('is_spotify_user')).toBe('false')
    })

    it('should call the correct API endpoint with display_name', async () => {
      const mockResponse = {
        data: {
          access_token: 'token',
          refresh_token: 'refresh',
          user_id: 'id',
          display_name: 'My Name',
          email: ''
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const authStore = useAuthStore()
      await authStore.manualLogin('My Name')

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/manual-login'),
        { display_name: 'My Name' }
      )
    })

    it('should handle API errors gracefully', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'))

      const authStore = useAuthStore()
      const result = await authStore.manualLogin('Guest')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(authStore.accessToken).toBeNull()
      expect(authStore.isSpotifyUser).toBe(true) // Should remain true on failure
    })

    it('should store tokens in localStorage', async () => {
      const mockResponse = {
        data: {
          access_token: 'stored-manual-access',
          refresh_token: 'stored-manual-refresh',
          user_id: 'manual-user-123',
          display_name: 'Stored Guest',
          email: ''
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const authStore = useAuthStore()
      await authStore.manualLogin('Stored Guest')

      expect(localStorage.getItem('access_token')).toBe('stored-manual-access')
      expect(localStorage.getItem('refresh_token')).toBe('stored-manual-refresh')
      expect(localStorage.getItem('is_spotify_user')).toBe('false')
      expect(JSON.parse(localStorage.getItem('user') || '{}')).toEqual({
        id: 'manual-user-123',
        displayName: 'Stored Guest',
        email: ''
      })
    })
  })

  describe('Getters', () => {
    it('isAuthenticated should return true when token exists', () => {
      const authStore = useAuthStore()

      authStore.setTokens('access-token', 'refresh-token')

      expect(authStore.isAuthenticated).toBe(true)
    })

    it('isAuthenticated should return false when no token', () => {
      const authStore = useAuthStore()

      expect(authStore.isAuthenticated).toBe(false)
    })

    it('userName should return display name when user exists', () => {
      const authStore = useAuthStore()

      authStore.setUser({
        id: '123',
        displayName: 'Funky Star',
        email: 'test@test.com'
      })

      expect(authStore.userName).toBe('Funky Star')
    })

    it('userName should return "Guest" when no user', () => {
      const authStore = useAuthStore()

      expect(authStore.userName).toBe('Guest')
    })
  })

  describe('Integration', () => {
    it('should maintain authentication state through reload', async () => {
      const mockResponse = {
        data: {
          access_token: 'persisted-token',
          refresh_token: 'persisted-refresh',
          user_id: 'persisted-id',
          display_name: 'Persisted User',
          email: 'persisted@test.com'
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      // Login
      const authStore1 = useAuthStore()
      await authStore1.testLogin()

      expect(authStore1.isAuthenticated).toBe(true)

      // Simulate page reload - create new store instance
      setActivePinia(createPinia())
      const authStore2 = useAuthStore()
      authStore2.loadFromStorage()

      // Should still be authenticated
      expect(authStore2.isAuthenticated).toBe(true)
      expect(authStore2.user?.displayName).toBe('Persisted User')
    })
  })
})
