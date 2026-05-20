import { useEffect, useRef } from 'react'
import { Milk, Calendar, ShoppingBag, BarChart2, Leaf, FlaskConical, Heart, Globe } from 'lucide-react'

const STATS = [
  { label: 'Cows on Farm',     value: '52+',   icon: <Milk size={28} /> },
  { label: 'Years of Farming', value: '10+',   icon: <Calendar size={28} /> },
  { label: 'Products',         value: '4',     icon: <ShoppingBag size={28} /> },
  { label: 'Daily Production', value: '500L+', icon: <BarChart2 size={28} /> },
]

const VALUES = [
  { icon: <Leaf size={32} />,        title: 'Natural Feeding',  desc: 'Our cows graze on natural pastures and are fed high-quality feed for optimal milk production.' },
  { icon: <FlaskConical size={32} />, title: 'Quality Tested',  desc: 'Every batch is tested for purity and quality before reaching your hands.' },
  { icon: <Heart size={32} />,        title: 'Animal Welfare',  desc: 'We prioritize the health and wellbeing of every cow on our farm.' },
  { icon: <Globe size={32} />,        title: 'Local Community', desc: 'Proudly serving Mwanza and surrounding communities with fresh dairy products.' },
]

export default function FarmPage() {
  const statsRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.stat-card').forEach((el, i) => {
            el.style.transition = `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`
            el.style.opacity = 1
            el.style.transform = 'translateY(0)'
          })
        }
      }),
      { threshold: 0.2 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--green-900) 0%, #1a5c38 100%)', color: '#fff', padding: '100px 24px 80px' }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            padding: '6px 16px', borderRadius: 100, fontSize: 13, marginBottom: 28,
          }}>
            🌿 Est. Mwanza, Tanzania
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-1.5px' }}>
            Fresh from the farm,<br />
            <span style={{ color: 'var(--green-400)' }}>straight to you.</span>
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.65 }}>
            Bushi Dairy Farm is Mwanza's trusted source for fresh, natural dairy products. From our herd to your home — quality you can taste.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/products" style={{
              background: 'var(--green-400)', color: 'var(--green-900)',
              padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
              textDecoration: 'none', transition: 'all 0.2s',
              boxShadow: '0 4px 15px rgba(77,184,130,0.3)',
            }}>
              View Products →
            </a>
            <a href="/contact" style={{
              background: 'rgba(255,255,255,0.1)', color: '#fff',
              border: '1.5px solid rgba(255,255,255,0.25)',
              padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 600,
              textDecoration: 'none', transition: 'all 0.2s',
            }}>
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section ref={statsRef} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--ink-10)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {STATS.map((s, i) => (
            <div key={s.label} className="stat-card" style={{
              padding: '32px 20px', textAlign: 'center',
              borderRight: i < STATS.length - 1 ? '1px solid var(--ink-10)' : 'none',
              opacity: 0, transform: 'translateY(20px)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--green-600)', marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--green-600)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-60)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── About ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 60, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--green-600)', marginBottom: 12 }}>About Us</p>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: 'var(--ink)', lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.5px' }}>
              A farm built on passion for quality dairy.
            </h2>
            <p style={{ fontSize: 15, color: 'var(--ink-60)', lineHeight: 1.8, marginBottom: 16 }}>
              Located in the heart of Mwanza at Maduka Tisa Stand, Bushi Dairy Farm has been serving the community with fresh, high-quality dairy products. Our farm combines modern dairy management with a deep commitment to animal welfare.
            </p>
            <p style={{ fontSize: 15, color: 'var(--ink-60)', lineHeight: 1.8 }}>
              With over 52 cows producing hundreds of litres daily, we process fresh milk into a range of products including yoghurt, mtindi, and packaged milk — all made with care and no artificial additives.
            </p>
          </div>
          {/* Visual card */}
          <div style={{ background: 'var(--green-900)', borderRadius: 20, padding: 32, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(77,184,130,0.1)' }} />
            <div style={{ fontSize: 48, marginBottom: 20 }}>🏡</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Maduka Tisa Stand</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24 }}>Mwanza, Tanzania</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Open', value: 'Mon – Sat' },
                { label: 'Hours', value: '6am – 6pm' },
                { label: 'Phone', value: '+255 655 763 844' },
                { label: 'Fresh daily', value: 'Every morning' },
              ].map(r => (
                <div key={r.label} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{r.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section style={{ background: 'var(--cream-dark)', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--green-600)', marginBottom: 10 }}>Our Values</p>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>Why choose Bushi Dairy?</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {VALUES.map(v => (
              <div key={v.title} style={{
                background: 'var(--surface)', borderRadius: 14, padding: 24,
                border: '1px solid var(--ink-10)', transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'var(--green-400)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--ink-10)' }}
              >
                <div style={{ color: 'var(--green-600)', marginBottom: 14 }}>{v.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{v.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-60)', lineHeight: 1.65 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}