"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"

export default function RegisterPage() {
    const { refresh } = useAuth()
    const router = useRouter()
    const [err, setErr] = useState("")

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        try {
            await api("/accounts/register", {
                method: "POST",
                body: { email: fd.get("email"), password: fd.get("password") },
            })
            await refresh()
            router.replace("/")
        } catch (e) {
            setErr(e instanceof ApiError ? e.message : "Something went wrong")
        }
    }

    return (
        <form onSubmit={onSubmit}>
            <input name="email" type="email" required />
            <input name="password" type="password" required />
            {err && <p role="alert">{err}</p>}
            <button type="submit">Sign up</button>
        </form>
    )
}
