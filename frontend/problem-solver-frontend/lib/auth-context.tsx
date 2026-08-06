"use client"
import { createContext, useContext, useEffect, useState } from "react"
import { api } from "./api"

type User = { id: number; email: string }
// undefined = still checking, null = definitely logged out
type State = User | null | undefined

const Ctx = createContext<{
    user: State
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    refresh: () => Promise<void>
}>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<State>(undefined)

    async function refresh() {
        try {
            setUser(await api<User>("/me"))
        } catch {
            setUser(null)
        }
    }

    useEffect(() => {
        // 1. seed the XSRF-TOKEN cookie (works while logged out)
        // 2. find out who we are
        api("/accounts/login").then(refresh).catch(() => setUser(null))
    }, [])

    async function login(email: string, password: string) {
        await api("/accounts/login", { method: "POST", body: { email, password } })
        setUser(await api<User>("/me"))
    }

    async function logout() {
        await api("/accounts/logout", { method: "POST", body: {} })
        setUser(null)
    }

    return <Ctx.Provider value={{ user, login, logout, refresh }}> {children} </Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)