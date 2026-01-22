import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatTime(time) {
  return time.replace('-', ' - ')
}

export function getDayShort(day) {
  const days = {
    MONDAY: 'Mon',
    TUESDAY: 'Tue',
    WEDNESDAY: 'Wed',
    THURSDAY: 'Thu',
    FRIDAY: 'Fri',
    SATURDAY: 'Sat',
  }
  return days[day] || day
}

export const TIME_SLOTS = [
  '09:00-10:00',
  '10:00-11:00',
  '11:00-11:30', // Break
  '11:30-12:30',
  '12:30-13:30',
  '13:30-14:30', // Lunch
  '14:30-15:30',
  '15:30-16:30',
]

export const SCHEDULABLE_SLOTS = [
  '09:00-10:00',
  '10:00-11:00',
  '11:30-12:30',
  '12:30-13:30',
  '14:30-15:30',
  '15:30-16:30',
]

export const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

export const BREAK_SLOTS = ['11:00-11:30', '13:30-14:30']
