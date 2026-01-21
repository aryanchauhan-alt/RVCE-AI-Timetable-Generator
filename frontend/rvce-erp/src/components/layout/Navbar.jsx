import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bell,
  Search,
  Moon,
  Sun,
  LogOut,
  User,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function Navbar({ title }) {
  const [darkMode, setDarkMode] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-30 h-20 bg-bg-primary/95 backdrop-blur-md border-b border-gray-200"
    >
      <div className="flex items-center justify-between h-full px-8">
        {/* Left: Title */}
        <div>
          <h2 className="text-2xl font-serif font-bold text-accent-navy">
            {title || 'Dashboard'}
          </h2>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full focus-within:border-accent-navy transition-colors">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-gray-400 font-sans"
            />
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative text-accent-navy hover:bg-gray-100 rounded-full">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rvce-maroon rounded-full border-2 border-white" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-white transition-all border border-transparent hover:border-gray-100">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-bold text-accent-navy font-serif">
                    {user?.username || 'User'}
                  </p>
                  <p className="text-xs text-text-secondary uppercase tracking-wider">
                    {user?.role || 'Student'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-accent-navy flex items-center justify-center text-white font-serif italic border-2 border-white shadow-sm">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 font-sans">
              <DropdownMenuLabel className="text-accent-navy">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  )
}
