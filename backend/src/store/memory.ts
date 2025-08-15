export type UpdateRecord = {
id: string
receivedAt: string
event: unknown
}

export type Employee = {
id: string
email: string
displayName: string
timezone?: string
isActive: boolean
chatUserId?: string
managerEmail?: string
}

export type MemoryStore = {
updates: UpdateRecord[]
employees: Employee[]
}

export function createStore(): MemoryStore {
return { updates: [], employees: [] }
}
