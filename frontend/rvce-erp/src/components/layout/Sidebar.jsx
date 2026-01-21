import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Calendar,
  Users,
  DoorOpen,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Edit3,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Calendar, label: 'View Timetable', path: '/timetable/view' },
  { icon: Edit3, label: 'Manage Timetable', path: '/timetable/manage' },
  { icon: Upload, label: 'Upload Data', path: '/upload' },
  { icon: Users, label: 'Faculty', path: '/faculty/manage' },
  { icon: DoorOpen, label: 'Rooms', path: '/rooms/manage' },
  { icon: BookOpen, label: 'Subjects', path: '/subjects/manage' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation()

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 flex flex-col shadow-card"
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-20 px-4 border-b border-gray-100">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-sm bg-accent-navy flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-accent-gold" />
              </div>
              <div>
                <h1 className="font-serif font-bold text-accent-navy text-lg">RVCE</h1>
                <p className="text-xs text-text-secondary tracking-wider uppercase">ERP Portal</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {collapsed && (
          <div className="w-10 h-10 mx-auto rounded-sm bg-accent-navy flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-accent-gold" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path))

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-md transition-all duration-300 group relative",
                    isActive
                      ? "bg-accent-navy text-white shadow-soft"
                      : "text-text-secondary hover:bg-bg-primary hover:text-accent-navy"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 flex-shrink-0 transition-colors",
                    isActive ? "text-accent-gold" : "text-gray-400 group-hover:text-accent-navy"
                  )} />

                  <AnimatePresence mode="wait">
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="font-medium text-sm whitespace-nowrap tracking-wide"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-3 py-1 bg-accent-navy text-white text-xs rounded-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 tracking-wider uppercase">
                      {item.label}
                    </div>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse Button */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md hover:bg-bg-primary transition-colors text-text-secondary"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Collapse Menu</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  )
}
