import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Moon,
  Sun,
  User,
  Lock,
  Bell,
  Globe,
  Database,
  LogOut,
  ChevronRight,
  Check,
  Shield,
  Monitor,
  Info,
} from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils.js'
import { useAuth } from '@/context/AuthContext'

const settingsSections = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'data', label: 'Data Management', icon: Database },
]

export default function Settings() {
  const [activeSection, setActiveSection] = useState('profile')
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  )
  const { user, logout } = useAuth()

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', isDarkMode ? 'light' : 'dark')
  }

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-accent-navy">Settings</h1>
          <p className="text-text-secondary mt-1">Manage your account preferences and application settings</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Settings Sidebar */}
          <aside className="w-full md:w-64 space-y-2">
            {[
              { id: 'profile', icon: User, label: 'Profile' },
              { id: 'appearance', icon: Monitor, label: 'Appearance' },
              { id: 'notifications', icon: Bell, label: 'Notifications' },
              { id: 'security', icon: Lock, label: 'Security' },
              { id: 'data', icon: Database, label: 'Data Management' },
              { id: 'about', icon: Info, label: 'About' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${activeSection === item.id
                  ? 'bg-accent-navy text-white shadow-md'
                  : 'text-text-secondary hover:bg-bg-secondary hover:text-accent-navy'
                  }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}

            <div className="pt-4 mt-4 border-t border-gray-100">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </aside>

          {/* Content Area */}
          <div className="flex-1">
            <Card className="shadow-card border-none min-h-[500px]">
              <CardContent className="p-6 space-y-6">
                {activeSection === 'profile' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Profile Information</CardTitle>
                        <CardDescription>
                          Update your personal information and email.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                            {user?.email?.[0]?.toUpperCase() || 'A'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {user?.email || 'admin@rvce.edu.in'}
                            </p>
                            <p className="text-sm text-gray-500">Administrator</p>
                          </div>
                        </div>

                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {activeSection === 'appearance' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Appearance</CardTitle>
                        <CardDescription>
                          Customize how the application looks.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-3">
                            {isDarkMode ? (
                              <Moon className="w-5 h-5 text-indigo-500" />
                            ) : (
                              <Sun className="w-5 h-5 text-yellow-500" />
                            )}
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                Dark Mode
                              </p>
                              <p className="text-sm text-gray-500">
                                {isDarkMode ? 'Currently using dark theme' : 'Currently using light theme'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={toggleDarkMode}
                            className={cn(
                              "w-12 h-6 rounded-full transition-colors relative",
                              isDarkMode ? "bg-indigo-600" : "bg-gray-300"
                            )}
                          >
                            <div
                              className={cn(
                                "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                                isDarkMode ? "translate-x-6" : "translate-x-0.5"
                              )}
                            />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <Label>Language</Label>
                          <Select defaultValue="en">
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="hi">Hindi</SelectItem>
                              <SelectItem value="kn">Kannada</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Accent Color</Label>
                          <div className="flex gap-2">
                            {['indigo', 'blue', 'purple', 'emerald', 'rose'].map((color) => (
                              <button
                                key={color}
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110",
                                  color === 'indigo' && "bg-indigo-500",
                                  color === 'blue' && "bg-blue-500",
                                  color === 'purple' && "bg-purple-500",
                                  color === 'emerald' && "bg-emerald-500",
                                  color === 'rose' && "bg-rose-500"
                                )}
                              >
                                {color === 'indigo' && <Check className="w-4 h-4 text-white" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {activeSection === 'notifications' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                        <CardDescription>
                          Configure how you receive notifications.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {[
                          { title: 'Email Notifications', desc: 'Receive email for important updates' },
                          { title: 'Timetable Changes', desc: 'Get notified when timetable is modified' },
                          { title: 'New Faculty Added', desc: 'Notification when new faculty joins' },
                          { title: 'System Alerts', desc: 'Critical system notifications' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                              <p className="text-sm text-gray-500">{item.desc}</p>
                            </div>
                            <button
                              className={cn(
                                "w-12 h-6 rounded-full transition-colors relative",
                                i < 2 ? "bg-indigo-600" : "bg-gray-300"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                                  i < 2 ? "translate-x-6" : "translate-x-0.5"
                                )}
                              />
                            </button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {activeSection === 'security' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Security Settings</CardTitle>
                        <CardDescription>
                          Manage your password and security preferences.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Current Password</Label>
                          <Input type="password" />
                        </div>
                        <div className="space-y-2">
                          <Label>New Password</Label>
                          <Input type="password" />
                        </div>
                        <div className="space-y-2">
                          <Label>Confirm Password</Label>
                          <Input type="password" />
                        </div>
                        <div className="flex justify-end">
                          <Button>Update Password</Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Two-Factor Authentication</CardTitle>
                        <CardDescription>
                          Add an extra layer of security to your account.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              2FA is currently disabled
                            </p>
                            <p className="text-sm text-gray-500">
                              Enable to secure your account
                            </p>
                          </div>
                          <Button variant="outline">Enable 2FA</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {activeSection === 'data' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Data Management</CardTitle>
                        <CardDescription>
                          Export, import, or clear your data.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              Export All Data
                            </p>
                            <p className="text-sm text-gray-500">
                              Download all timetables, faculty, and room data
                            </p>
                          </div>
                          <Button variant="outline">Export</Button>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              Import Data
                            </p>
                            <p className="text-sm text-gray-500">
                              Import data from a backup file
                            </p>
                          </div>
                          <Button variant="outline">Import</Button>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
                          <div>
                            <p className="font-medium text-red-700 dark:text-red-400">
                              Clear All Timetables
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-500">
                              This action cannot be undone
                            </p>
                          </div>
                          <Button variant="destructive">Clear</Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Database Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Connection</span>
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              Connected
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Database</span>
                            <span className="text-gray-900 dark:text-white">Supabase PostgreSQL</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Last Sync</span>
                            <span className="text-gray-900 dark:text-white">2 minutes ago</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
