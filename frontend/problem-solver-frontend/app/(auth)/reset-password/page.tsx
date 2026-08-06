"use client"
import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { api, ApiError } from "@/lib/api"

function ResetForm() {
    const token = useSearchParams().get("token")
    const [err, setErr] = useState("")

    if (!token) return <p role="alert">Missing or invalid reset link.</p>

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        try {
            await api(`/accounts/reset/${token}`, {
                method: "POST",
                body: { password: fd.get("password"), password_confirm: fd.get("password_confirm") },
            })
        } catch (e) {
            setErr(e instanceof ApiError ? e.message : "Something went wrong")
        }
    }
    return (
        <form onSubmit={onSubmit}>
            {err && <p role="alert">{err}</p>}
            {/* … */}
        </form>
    )
}

export default function Page() {
    return <Suspense fallback={<div>Loading…</div>}><ResetForm /></Suspense>
}