"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { ApiError } from "@/lib/api"

export default function LoginPage() {
    const { login } = useAuth()
    const router = useRouter()
    const [err, setErr] = useState("")

    async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        try {
            await login(String(fd.get("email")), String(fd.get("password")))
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
            <button type="submit">Sign in</button>
        </form>
    )
}