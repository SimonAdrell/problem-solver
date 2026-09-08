"use client"

import { useRef, useState } from "react"
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google"
import { api, ApiError } from "@/lib/api"

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

// Agent output — the model can omit any key, so the arrays the UI maps over
// are optional and every read of them goes through `?? []`.
type Idea = {
  app_concept: string
  ai_approach: string
  required_inputs?: string[]
  azure_services?: string[]
  first_step: string
}

type Result = {
  brief: {
    core_problem: string
    persona: string
    inputs?: string[]
    success_criteria: string
  }
  ideas: Idea[]
}

type Blueprint = {
  architecture: string
  build_estimate?: { weeks: string; drivers: string }
  risks?: { risk: string; check: string }[]
  image_prompt: string
}

type IdeaState = {
  bp?: Blueprint
  bpLoading?: boolean
  bpError?: string
  img?: string
  imgLoading?: boolean
  imgError?: boolean
}

type Stage = "intake" | "blueprint"

const EXAMPLES = [
  "Our support team keeps answering the same questions but nobody can find the old answers.",
  "Reviewing supplier contracts takes days and we still miss the risky clauses.",
  "We have five years of field photos and no idea what's in them.",
]

// ponytail: native View Transitions API for the world-swap, no animation lib. No-ops (and respects reduced motion) where unsupported.
function withTransition(run: () => void) {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !document.startViewTransition
  ) {
    return run()
  }
  // A further state update while the snapshot is being captured (e.g. the
  // blueprint fetch kicking off right after) skips the animation — `ready`
  // rejects when that happens even though the page still updates correctly.
  const transition = document.startViewTransition(run)
  transition.ready.catch(() => {})
  transition.finished.catch(() => {})
}

// ponytail: both sheets' loading states are the same pulsing bars in different inks.
function Skeleton({ bars, className }: { bars: string[]; className: string }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {bars.map((bar, i) => (
        <div
          key={i}
          style={{ animationDelay: `${i * 110}ms` }}
          className={`${bar} animate-pulse ${className}`}
        />
      ))}
    </div>
  )
}

export default function SolvePage() {
  const [problem, setProblem] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [solveError, setSolveError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<Record<number, IdeaState>>({})
  const [stage, setStage] = useState<Stage>("intake")
  const [selected, setSelected] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Bumped on every submit()/startOver() (i.e. every cards reset). A blueprint
  // or image fetch checks this after its await — if it's moved on, a newer
  // session has started and the response is stale, so it's dropped instead of
  // being written into the new session's cards.
  const generationRef = useRef(0)

  async function submit() {
    const trimmed = problem.trim()
    if (!trimmed || loading) return
    generationRef.current++
    setLoading(true)
    setSolveError(null)
    setResult(null)
    setCards({})
    try {
      const data = await api<Result>("/solve", {
        method: "POST",
        body: { problem: trimmed },
      })
      setResult(data)
    } catch (e) {
      setSolveError(
        e instanceof ApiError ? e.message : "Something went wrong. Try again.",
      )
    } finally {
      setLoading(false)
    }
  }

  async function fetchBlueprint(i: number, idea: Idea) {
    if (!result || cards[i]?.bpLoading) return
    const gen = generationRef.current
    setCards((c) => ({ ...c, [i]: { ...c[i], bpLoading: true, bpError: undefined } }))
    try {
      const { blueprint } = await api<{ blueprint: Blueprint }>("/blueprint", {
        method: "POST",
        body: { brief: result.brief, idea },
      })
      if (gen !== generationRef.current) return // a newer session started — drop it
      setCards((c) => ({ ...c, [i]: { ...c[i], bp: blueprint, bpLoading: false } }))
      fetchImage(i, blueprint.image_prompt, gen)
    } catch (e) {
      if (gen !== generationRef.current) return
      setCards((c) => ({
        ...c,
        [i]: {
          ...c[i],
          bpLoading: false,
          bpError:
            e instanceof ApiError ? e.message : "Couldn't draft this blueprint.",
        },
      }))
    }
  }

  function fetchImage(i: number, prompt: string, gen: number = generationRef.current) {
    setCards((c) => ({ ...c, [i]: { ...c[i], imgLoading: true, imgError: false } }))
    api<{ image: string }>("/image", { method: "POST", body: { image_prompt: prompt } })
      .then(({ image }) => {
        if (gen !== generationRef.current) return
        setCards((c) => ({ ...c, [i]: { ...c[i], img: image, imgLoading: false } }))
      })
      .catch(() => {
        if (gen !== generationRef.current) return
        setCards((c) => ({ ...c, [i]: { ...c[i], imgLoading: false, imgError: true } }))
      })
  }

  function selectIdea(i: number, idea: Idea) {
    withTransition(() => {
      setSelected(i)
      setStage("blueprint")
    })
    // ponytail: cached blueprint here, in-flight guard in fetchBlueprint —
    // Sheet 1 is reachable again mid-fetch, so both are needed.
    if (cards[i]?.bp) return
    fetchBlueprint(i, idea)
  }

  function startOver() {
    generationRef.current++
    withTransition(() => {
      setResult(null)
      setSolveError(null)
      setCards({})
      setSelected(null)
      setStage("intake")
    })
    setProblem("")
    textareaRef.current?.focus()
  }

  const selectedIdea =
    selected !== null ? result?.ideas[selected] : undefined
  const selectedCard = selected !== null ? cards[selected] : undefined

  return (
    <main
      className={`${plexSans.variable} ${plexMono.variable} min-h-screen font-[family-name:var(--font-plex-sans)] ${
        stage === "intake" ? "bg-paper text-ink" : "bg-blueprint text-blueprint-ink"
      }`}
    >
      {/* ── Title block ─────────────────────────────────────── */}
      <div
        className={`flex items-center justify-between border-b px-6 py-2.5 font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.14em] uppercase ${
          stage === "intake"
            ? "border-ink/15 text-ink-muted"
            : "border-blueprint-line/30 text-blueprint-ink-muted"
        }`}
      >
        <span className="hidden font-medium sm:inline">Problem Solver</span>
        <span>
          Sheet {stage === "intake" ? 1 : 2}/2 — {stage === "intake" ? "Intake" : "Blueprint"}
        </span>
        {stage === "blueprint" ? (
          <button
            type="button"
            onClick={() => withTransition(() => setStage("intake"))}
            className="normal-case underline underline-offset-4 hover:text-blueprint-ink"
          >
            ← Sheet 1
          </button>
        ) : result ? (
          <button
            type="button"
            onClick={startOver}
            className="normal-case underline underline-offset-4 hover:text-ink"
          >
            Start over
          </button>
        ) : (
          <span />
        )}
      </div>

      {stage === "intake" ? (
        <div className="mx-auto flex max-w-3xl flex-col gap-12 px-6 pt-16 pb-32">
          {/* ── Header ───────────────────────────────────────── */}
          <header className="flex flex-col gap-4">
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">
              What&apos;s not working?
            </h1>
            <p className="max-w-lg text-[15px] leading-relaxed text-pretty text-ink-muted">
              Write it messy — we&apos;ll turn it into a clear brief, three
              buildable ideas, and an Azure blueprint for the one you pick.
            </p>
          </header>

          {/* ── Composer ─────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-md border border-ink/15 bg-white/40 transition-colors focus-within:border-margin">
              <span
                aria-hidden
                className="absolute top-0 bottom-0 left-10 w-px bg-margin/40"
              />
              <textarea
                ref={textareaRef}
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit()
                }}
                disabled={loading}
                rows={5}
                placeholder="e.g. Nobody on the team knows which of our 400 internal docs is still true…"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(transparent, transparent 27px, rgba(157,184,217,0.55) 28px)",
                  backgroundPositionY: "6px",
                }}
                className="w-full resize-none bg-transparent py-1.5 pr-5 pl-14 text-[15px] leading-7 placeholder:text-ink-muted/60 focus:outline-none disabled:opacity-60"
              />
              <div className="flex items-center justify-between gap-4 border-t border-ink/10 px-4 py-3">
                <span className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[11px] whitespace-nowrap text-ink-muted">
                  ⌘↵ to submit
                </span>
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !problem.trim()}
                  className="inline-flex items-center gap-2 rounded whitespace-nowrap bg-margin px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-margin-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin disabled:pointer-events-none disabled:opacity-40"
                >
                  {loading ? "Working…" : "Sharpen it"}
                  <span aria-hidden>→</span>
                </button>
              </div>
            </div>

            {!result && !loading && !solveError && (
              <div className="flex flex-col gap-2 pt-2">
                <span className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.14em] text-ink-muted uppercase">
                  Or start from
                </span>
                <div className="flex flex-col gap-1">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        setProblem(ex)
                        textareaRef.current?.focus()
                      }}
                      className="group flex items-start gap-2.5 rounded px-2 py-1.5 text-left text-[14px] leading-snug text-ink-muted transition-colors hover:text-ink"
                    >
                      <span className="pt-[3px] text-margin" aria-hidden>
                        —
                      </span>
                      <span className="group-hover:underline group-hover:decoration-margin/50 group-hover:underline-offset-4">
                        {ex}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Solve error ──────────────────────────────────── */}
          {solveError && (
            <div
              role="alert"
              className="rounded-md border border-margin/40 bg-margin/5 px-5 py-4"
            >
              <p className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.14em] text-margin-text uppercase">
                Request failed
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed">{solveError}</p>
              <button
                type="button"
                onClick={submit}
                className="mt-3 text-[13px] font-medium text-margin-text underline underline-offset-4 hover:text-margin"
              >
                Try again
              </button>
            </div>
          )}

          {/* ── Loading ──────────────────────────────────────── */}
          {loading && (
            <Skeleton
              bars={["w-1/3 h-3", "w-full h-5", "w-5/6 h-5", "w-2/5 h-3", "w-full h-5"]}
              className="rounded-full bg-ink/10"
            />
          )}

          {/* ── Result ───────────────────────────────────────── */}
          {result && !loading && (
            <div className="flex flex-col gap-14" aria-live="polite">
              <section className="flex flex-col gap-5">
                <span className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.18em] text-ink-muted uppercase">
                  The brief
                </span>

                <p className="border-l-4 border-margin py-1 pl-4 text-[23px] leading-[1.35] font-semibold tracking-tight text-pretty">
                  {result.brief.core_problem}
                </p>

                <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <dt className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.14em] text-ink-muted uppercase">
                      Who it&apos;s for
                    </dt>
                    <dd className="text-[14px] leading-relaxed text-ink-muted">
                      {result.brief.persona}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <dt className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.14em] text-ink-muted uppercase">
                      Success looks like
                    </dt>
                    <dd className="text-[14px] leading-relaxed text-ink-muted">
                      {result.brief.success_criteria}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <dt className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.14em] text-ink-muted uppercase">
                      What we have to work with
                    </dt>
                    <dd>
                      <ul className="flex flex-col gap-1">
                        {(result.brief.inputs ?? []).map((input) => (
                          <li
                            key={input}
                            className="flex gap-2.5 text-[14px] leading-relaxed text-ink-muted"
                          >
                            <span className="text-margin/70" aria-hidden>
                              —
                            </span>
                            {input}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="flex flex-col gap-5">
                <span className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.18em] text-ink-muted uppercase">
                  Three ways to build it
                </span>

                <div className="grid gap-4 md:grid-cols-3">
                  {result.ideas.map((idea, i) => (
                    <div
                      key={i}
                      className="flex flex-col overflow-hidden rounded-md border border-ink/15 bg-white/50 transition-shadow hover:shadow-md"
                    >
                      <span className="h-1.5 bg-margin" aria-hidden />
                      <div className="flex flex-1 flex-col gap-4 p-5">
                        <h2 className="text-[19px] leading-[1.2] font-semibold tracking-tight text-balance">
                          {idea.app_concept}
                        </h2>
                        <p className="text-[14px] leading-relaxed text-pretty text-ink-muted">
                          {idea.ai_approach}
                        </p>

                        <div className="flex flex-col gap-2">
                          <span className="font-[family-name:var(--font-plex-mono)] text-[10px] tracking-[0.14em] text-ink-muted/80 uppercase">
                            Needs
                          </span>
                          <ul className="flex flex-col gap-1">
                            {(idea.required_inputs ?? []).map((input) => (
                              <li key={input} className="text-[13px] leading-relaxed text-ink-muted">
                                {input}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {(idea.azure_services ?? []).map((svc) => (
                            <span
                              key={svc}
                              className="rounded border border-ink/15 bg-paper px-2 py-0.5 font-[family-name:var(--font-plex-mono)] text-[11px] text-ink-muted"
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => selectIdea(i, idea)}
                        className="flex items-center justify-between gap-2 border-t border-ink/10 bg-ink/[0.03] px-5 py-3 text-left text-[13px] font-medium transition-colors hover:bg-margin hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-margin"
                      >
                        Draft blueprint
                        <span aria-hidden>→</span>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 pt-16 pb-32">
          <header className="flex flex-col gap-1.5">
            <span className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.14em] text-blueprint-ink-muted uppercase">
              Drafting
            </span>
            <h1 className="text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-[34px]">
              {selectedIdea?.app_concept}
            </h1>
          </header>

          <div aria-live="polite" className="flex flex-col gap-10">
            {selectedCard?.bpLoading && (
              <Skeleton
                bars={["w-1/4 h-3", "w-full h-4", "w-5/6 h-4", "w-2/3 h-4", "w-1/3 h-16"]}
                className="rounded bg-blueprint-line/15"
              />
            )}

            {selectedCard?.bpError && (
              <div className="rounded-md border border-margin-bright/50 bg-margin/10 px-5 py-4">
                <p className="text-[14px] leading-relaxed">{selectedCard.bpError}</p>
                <button
                  type="button"
                  onClick={() => selected !== null && selectedIdea && fetchBlueprint(selected, selectedIdea)}
                  className="mt-3 text-[13px] font-medium text-margin-bright-text underline underline-offset-4 hover:text-white"
                >
                  Retry
                </button>
              </div>
            )}

            {selectedCard?.bp && (
              <>
                <section className="flex flex-col gap-3">
                  <span className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.14em] text-blueprint-ink-muted uppercase">
                    How it&apos;s built
                  </span>
                  <p className="text-[15px] leading-relaxed text-blueprint-ink-muted">
                    {selectedCard.bp.architecture}
                  </p>
                </section>

                {selectedCard.bp.build_estimate && (
                  <section className="flex flex-col gap-3 border-t border-blueprint-line/20 pt-8 sm:flex-row sm:items-start sm:gap-6">
                    <div className="inline-flex -rotate-2 flex-col items-center gap-0.5 self-start rounded border-2 border-blueprint-line/60 px-4 py-2">
                      <span className="font-[family-name:var(--font-plex-mono)] text-[10px] tracking-[0.14em] text-blueprint-ink-muted uppercase">
                        Est.
                      </span>
                      <span className="font-[family-name:var(--font-plex-mono)] text-[15px] font-medium whitespace-nowrap">
                        {selectedCard.bp.build_estimate.weeks}
                      </span>
                    </div>
                    <p className="text-[14px] leading-relaxed text-blueprint-ink-muted">
                      {selectedCard.bp.build_estimate.drivers}
                    </p>
                  </section>
                )}

                <section className="flex flex-col gap-4 border-t border-blueprint-line/20 pt-8">
                  <span className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.14em] text-blueprint-ink-muted uppercase">
                    What could go wrong
                  </span>
                  <ul className="flex flex-col gap-4">
                    {(selectedCard.bp.risks ?? []).map((r) => (
                      <li key={r.risk} className="flex gap-3">
                        <svg
                          aria-hidden
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          className="mt-[5px] shrink-0 fill-margin-bright"
                        >
                          <path d="M0 0h10L0 10z" />
                        </svg>
                        <div className="flex flex-col gap-1">
                          <span className="text-[14px] font-medium">{r.risk}</span>
                          <span className="text-[13px] leading-relaxed text-blueprint-ink-muted">
                            {r.check}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="flex flex-col gap-2 border-t border-blueprint-line/20 pt-8">
                  <div className="aspect-[4/3] overflow-hidden rounded border border-blueprint-line/30 bg-blueprint-deep">
                    {selectedCard.img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedCard.img}
                        alt={`Concept render for: ${selectedIdea?.app_concept ?? ""}`}
                        className="size-full object-cover"
                      />
                    ) : selectedCard.imgError ? (
                      <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
                        <p className="text-[13px] text-blueprint-ink-muted">
                          Concept image not available.
                        </p>
                        <button
                          type="button"
                          onClick={() => fetchImage(selected as number, selectedCard.bp!.image_prompt)}
                          className="text-[13px] font-medium text-margin-bright-text underline underline-offset-4 hover:text-white"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <div className="size-full animate-pulse" />
                    )}
                  </div>
                  <span className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.1em] text-blueprint-ink-muted uppercase">
                    Fig. 1 — Concept render
                  </span>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
