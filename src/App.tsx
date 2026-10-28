import { useEffect, useRef } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { HomePage } from './pages/HomePage'
import { TryNowPage } from './pages/TryNowPage'

gsap.registerPlugin(ScrollTrigger)

function App() {
  const location = useLocation()
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({ autoRaf: false, smoothWheel: true })
    lenisRef.current = lenis
    const updateScrollTrigger = () => ScrollTrigger.update()
    const animate = (time: number) => lenis.raf(time * 1000)

    lenis.on('scroll', updateScrollTrigger)
    gsap.ticker.add(animate)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(animate)
      lenis.off('scroll', updateScrollTrigger)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  useEffect(() => {
    let frame = 0
    if (location.hash) {
      frame = window.requestAnimationFrame(() => {
        const target = document.getElementById(
          decodeURIComponent(location.hash.slice(1)),
        )
        if (target) {
          if (lenisRef.current) {
            lenisRef.current.scrollTo(target, { offset: -20 })
          } else {
            target.scrollIntoView()
          }
        }
      })
    } else {
      lenisRef.current?.scrollTo(0, { immediate: true })
    }
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash, location.pathname])

  return (
    <>
      <Routes>
        <Route element={<HomePage />} path="/" />
        <Route element={<TryNowPage />} path="/try-now" />
      </Routes>
    </>
  )
}

export default App
