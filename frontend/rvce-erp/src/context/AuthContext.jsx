import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase, authService } from '@/lib/supabase.js'

const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check initial session
    checkSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const userData = await buildUserData(session.user)
          setUser(userData)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          localStorage.removeItem('mockUser')
        }
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  async function buildUserData(supabaseUser) {
    // Try to get user profile/role from Supabase
    let role = 'student'
    
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', supabaseUser.id)
        .single()
      
      if (profile?.role) {
        role = profile.role
      }
    } catch (err) {
      // Profile might not exist yet, use email-based role detection
      const email = supabaseUser.email?.toLowerCase() || ''
      if (email.includes('admin')) role = 'admin'
      else if (email.includes('teacher') || email.includes('faculty')) role = 'teacher'
    }

    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      username: supabaseUser.email?.split('@')[0] || 'user',
      role,
    }
  }

  async function checkSession() {
    try {
      // First check Supabase session
      const session = await authService.getSession()
      
      if (session?.user) {
        const userData = await buildUserData(session.user)
        setUser(userData)
        setLoading(false)
        return
      }

      // Fallback: Check for mock user in localStorage
      const mockUser = localStorage.getItem('mockUser')
      if (mockUser) {
        setUser(JSON.parse(mockUser))
      }
    } catch (error) {
      console.error('Session check failed:', error)
      // Fallback to mock user
      const mockUser = localStorage.getItem('mockUser')
      if (mockUser) {
        setUser(JSON.parse(mockUser))
      }
    } finally {
      setLoading(false)
    }
  }

  async function login(email, password, role) {
    try {
      setLoading(true)

      // Try Supabase authentication first
      try {
        const data = await authService.signIn(email, password)
        
        if (data?.user) {
          const userData = await buildUserData(data.user)
          setUser(userData)
          localStorage.setItem('mockUser', JSON.stringify(userData))
          setLoading(false)
          return { success: true }
        }
      } catch (supabaseError) {
        console.log('Supabase auth failed, falling back to mock login:', supabaseError.message)
      }

      // Fallback: Demo/Mock login for development
      if ((email === 'admin' && password === 'admin123') || 
          (email === 'admin@rvce.edu.in' && password === 'admin123') ||
          (role && email)) {
        
        let mockRole = role || 'student'
        const lowerEmail = email.toLowerCase()
        if (lowerEmail === 'admin' || lowerEmail.includes('admin')) mockRole = 'admin'
        else if (lowerEmail.includes('teacher') || lowerEmail.includes('faculty')) mockRole = 'teacher'

        const mockUser = {
          id: `mock-${mockRole}-${Date.now()}`,
          email: email.includes('@') ? email : `${email}@rvce.edu.in`,
          username: email.split('@')[0],
          role: mockRole,
        }
        
        setUser(mockUser)
        localStorage.setItem('mockUser', JSON.stringify(mockUser))
        setLoading(false)
        return { success: true }
      }

      setLoading(false)
      return { success: false, error: 'Invalid credentials' }
    } catch (error) {
      setLoading(false)
      return {
        success: false,
        error: error.message || 'Login failed'
      }
    }
  }

  async function signUp(email, password, role = 'student') {
    try {
      setLoading(true)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role }
        }
      })

      if (error) throw error

      // Create user profile
      if (data?.user) {
        await supabase.from('user_profiles').insert({
          user_id: data.user.id,
          role: role
        })
      }

      setLoading(false)
      return { success: true, data }
    } catch (error) {
      setLoading(false)
      return { success: false, error: error.message }
    }
  }

  function setUserRole(role) {
    setUser(prev => {
      if (!prev) return { role }
      const updated = { ...prev, role }
      localStorage.setItem('mockUser', JSON.stringify(updated))
      return updated
    })
  }

  async function logout() {
    try {
      // Try Supabase signout
      await authService.signOut()
    } catch (error) {
      console.error('Supabase logout failed:', error)
    } finally {
      // Always clear local state
      localStorage.removeItem('mockUser')
      setUser(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      signUp,
      loading,
      setUserRole,
      isAdmin: user?.role === 'admin',
      isTeacher: user?.role === 'teacher',
      isStudent: user?.role === 'student',
    }}>
      {children}
    </AuthContext.Provider>
  )
}
