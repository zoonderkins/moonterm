/**
 * Command Bookmarks Manager
 * Stores bookmarked commands per workspace in localStorage
 */

import type { CommandBookmark } from '../types'

const STORAGE_KEY_PREFIX = 'command-bookmarks-'

/**
 * Get storage key for a workspace
 */
function getStorageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`
}

/**
 * Generate unique ID for bookmark
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Load bookmarks for a workspace from localStorage
 */
export function loadBookmarks(workspaceId: string): CommandBookmark[] {
  try {
    const data = localStorage.getItem(getStorageKey(workspaceId))
    if (!data) return []
    return JSON.parse(data) as CommandBookmark[]
  } catch {
    return []
  }
}

/**
 * Save bookmarks for a workspace to localStorage
 */
export function saveBookmarks(workspaceId: string, bookmarks: CommandBookmark[]): void {
  try {
    localStorage.setItem(getStorageKey(workspaceId), JSON.stringify(bookmarks))
  } catch (error) {
    console.error('[CommandBookmarks] Failed to save:', error)
  }
}

/**
 * Add a new bookmark
 */
export function addBookmark(
  workspaceId: string,
  command: string,
  alias?: string,
  description?: string
): CommandBookmark {
  const bookmarks = loadBookmarks(workspaceId)
  const now = Date.now()

  const bookmark: CommandBookmark = {
    id: generateId(),
    command: command.trim(),
    alias: alias?.trim() || undefined,
    description: description?.trim() || undefined,
    workspaceId,
    createdAt: now,
    updatedAt: now
  }

  bookmarks.push(bookmark)
  saveBookmarks(workspaceId, bookmarks)

  return bookmark
}

/**
 * Update an existing bookmark
 */
export function updateBookmark(
  workspaceId: string,
  bookmarkId: string,
  updates: {
    command?: string
    alias?: string
    description?: string
  }
): CommandBookmark | null {
  const bookmarks = loadBookmarks(workspaceId)
  const index = bookmarks.findIndex(b => b.id === bookmarkId)

  if (index === -1) return null

  const bookmark = bookmarks[index]
  const updated: CommandBookmark = {
    ...bookmark,
    command: updates.command?.trim() ?? bookmark.command,
    alias: updates.alias?.trim() || undefined,
    description: updates.description?.trim() || undefined,
    updatedAt: Date.now()
  }

  bookmarks[index] = updated
  saveBookmarks(workspaceId, bookmarks)

  return updated
}

/**
 * Delete a bookmark
 */
export function deleteBookmark(workspaceId: string, bookmarkId: string): boolean {
  const bookmarks = loadBookmarks(workspaceId)
  const filtered = bookmarks.filter(b => b.id !== bookmarkId)

  if (filtered.length === bookmarks.length) return false

  saveBookmarks(workspaceId, filtered)
  return true
}

/**
 * Search bookmarks by command, alias, or description
 */
export function searchBookmarks(workspaceId: string, query: string): CommandBookmark[] {
  const bookmarks = loadBookmarks(workspaceId)
  if (!query.trim()) return bookmarks

  const lowerQuery = query.toLowerCase()
  return bookmarks.filter(b =>
    b.command.toLowerCase().includes(lowerQuery) ||
    b.alias?.toLowerCase().includes(lowerQuery) ||
    b.description?.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Check if a command is already bookmarked
 */
export function isBookmarked(workspaceId: string, command: string): boolean {
  const bookmarks = loadBookmarks(workspaceId)
  return bookmarks.some(b => b.command === command.trim())
}

/**
 * Get bookmark by command
 */
export function getBookmarkByCommand(workspaceId: string, command: string): CommandBookmark | undefined {
  const bookmarks = loadBookmarks(workspaceId)
  return bookmarks.find(b => b.command === command.trim())
}

/**
 * Clean up orphaned bookmark storage for deleted workspaces
 */
export function cleanupOrphanedBookmarks(validWorkspaceIds: string[]): void {
  const validSet = new Set(validWorkspaceIds)
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      const workspaceId = key.slice(STORAGE_KEY_PREFIX.length)
      if (!validSet.has(workspaceId)) {
        keysToRemove.push(key)
      }
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
}
