import { expect, test, beforeEach, vi } from 'vitest'
import { useThreads } from './useThreads'

// Mock the external dependencies
vi.mock('@/services/threads', () => ({
  createThread: vi.fn().mockResolvedValue({}),
  updateThread: vi.fn().mockResolvedValue({}),
  deleteThread: vi.fn().mockResolvedValue({}),
}))

beforeEach(() => {
  // Reset the store before each test
  useThreads.setState({
    threads: {},
    currentThreadId: undefined,
    searchIndex: null,
  })
})

test('renaming a thread should not change its chronological position', () => {
  const { setThreads, renameThread } = useThreads.getState()
  
  // Create mock threads with different created timestamps
  const threads: Thread[] = [
    {
      id: 'thread1',
      title: 'First Thread',
      created: 1000,
      updated: 1000,
      order: 1,
      model: { id: 'model1', provider: 'test' },
      assistants: [],
    },
    {
      id: 'thread2', 
      title: 'Second Thread',
      created: 2000,
      updated: 2000,
      order: 2,
      model: { id: 'model1', provider: 'test' },
      assistants: [],
    },
    {
      id: 'thread3',
      title: 'Third Thread', 
      created: 3000,
      updated: 3000,
      order: 3,
      model: { id: 'model1', provider: 'test' },
      assistants: [],
    },
  ]
  
  // Set initial threads
  setThreads(threads)
  
  // Get initial state
  const initialThreads = useThreads.getState().threads
  const initialOrder = Object.values(initialThreads).map(t => ({ id: t.id, order: t.order }))
  
  // Rename the second thread
  renameThread('thread2', 'Renamed Second Thread')
  
  // Get state after rename
  const updatedThreads = useThreads.getState().threads
  const updatedOrder = Object.values(updatedThreads).map(t => ({ id: t.id, order: t.order }))
  
  // Verify the order hasn't changed
  expect(updatedOrder).toEqual(initialOrder)
  
  // Verify the title was updated
  expect(updatedThreads['thread2'].title).toBe('Renamed Second Thread')
  
  // Verify the updated timestamp was not changed (preserving chronological order)
  expect(updatedThreads['thread2'].updated).toBe(2000)
})

test('updateThreadTimestamp should update timestamp but preserve order', () => {
  const { setThreads, updateThreadTimestamp } = useThreads.getState()
  
  const threads: Thread[] = [
    {
      id: 'thread1',
      title: 'First Thread',
      created: 1000,
      updated: 1000,
      order: 1,
      model: { id: 'model1', provider: 'test' },
      assistants: [],
    },
    {
      id: 'thread2',
      title: 'Second Thread',
      created: 2000,
      updated: 2000,
      order: 2,
      model: { id: 'model1', provider: 'test' },
      assistants: [],
    },
  ]
  
  setThreads(threads)
  
  const initialThreads = useThreads.getState().threads
  const initialOrder = Object.values(initialThreads).map(t => ({ id: t.id, order: t.order }))
  
  // Update timestamp for second thread
  updateThreadTimestamp('thread2')
  
  const updatedThreads = useThreads.getState().threads
  const updatedOrder = Object.values(updatedThreads).map(t => ({ id: t.id, order: t.order }))
  
  // Order should remain the same (no reordering)
  expect(updatedOrder).toEqual(initialOrder)
  
  // Updated timestamp should be newer
  expect(updatedThreads['thread2'].updated).toBeGreaterThan(2000)
})