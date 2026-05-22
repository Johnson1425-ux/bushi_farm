import { useState } from 'react'
import { Leaf, Snowflake, Milk, BadgeCheck } from 'lucide-react'
import strawberry1L from '../assets/strawberry_yoghurt_1L.png'

const PRODUCTS = [
  {
    id: 'milk',
    name: 'Fresh Milk',
    emoji: '🥛',
    desc: 'Pure, fresh cow milk collected daily from our healthy herd. No additives, no preservatives — just natural goodness.',
    color: '#e8f4ff',
    accent: '#3478c8',
    sizes: [
      { size: '0.5L', label: '500ml Bottle' },
      { size: '1L',   label: '1 Litre' },
      { size: '2L',   label: '2 Litres' },
      { size: '3L',   label: '3 Litres' },
      { size: '5L',   label: '5 Litres' },
      { size: '10L',  label: '10 Litres (Bulk)' },
    ],
    tags: ['Fresh', 'Daily', 'Natural'],
  },
  {
    id: 'vanilla',
    name: 'Vanilla Yoghurt',
    emoji: '🍦',
    desc: 'Creamy yoghurt with a rich vanilla flavour. Made from fresh farm milk with natural vanilla — smooth, thick and delicious.',
    color: '#fffbeb',
    accent: '#e8a020',
    sizes: [
      { size: '150ML', label: '150ml Cup' },
      { size: '0.5L',  label: '500ml Bottle' },
      { size: '1L',    label: '1 Litre' },
      { size: '2L',    label: '2 Litres' },
    ],
    tags: ['Yoghurt', 'Vanilla', 'Creamy'],
  },
  {
    id: 'strawberry',
    name: 'Strawberry Yoghurt',
    image: strawberry1L,
    desc: 'Fruity and refreshing yoghurt bursting with strawberry flavour. A family favourite — perfect for breakfast or a healthy snack.',
    color: '#fff0f0',
    accent: '#d94040',
    sizes: [
      { size: '150ML', label: '150ml Cup' },
      { size: '0.5L',  label: '500ml Bottle' },
      { size: '1L',    label: '1 Litre' },
      { size: '2L',    label: '2 Litres' },
    ],
    tags: ['Yoghurt', 'Strawberry', 'Fruity'],
  },
  {
    id: 'mtindi',
    name: 'Mtindi Bonge',
    emoji: '🫙',
    desc: 'Traditional fermented milk — a Tanzanian staple. Our Mtindi Bonge is naturally fermented for a rich, authentic taste beloved across the region.',
    color: '#f0faf4',
    accent: '#2a8a56',
    sizes: [
      { size: '0.5L CHUPA', label: '500ml Bottle' },
      { size: '0.5L CUP',   label: '500ml Cup' },
      { size: 'PACT O.5L',  label: '500ml Pack' },
      { size: '1L',         label: '1 Litre' },
    ],
    tags: ['Traditional', 'Fermented', 'Authentic'],
  },
]

export default function ProductsPage() {
  const [active, setActive] = useState(null)

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(135deg, var(--green-900) 0%, #1a5c38 100%)', padding: '72px 24px 60px', textAlign: 'center', color: '#fff' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--green-400)', marginBottom: 12 }}>Our Products</p>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 16 }}>
          Pure dairy, fresh daily.
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', maxWidth: 480, margin: '0 auto' }}>
          From our farm in Mwanza to your table — all products are made with fresh milk and zero artificial additives.
        </p>
      </section>

      {/* ── Products grid ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {PRODUCTS.map(p => (
            <div
              key={p.id}
              onClick={() => setActive(active === p.id ? null : p.id)}
              style={{
                background: 'var(--surface)', borderRadius: 18, overflow: 'hidden',
                border: `2px solid ${active === p.id ? p.accent : 'var(--ink-10)'}`,
                cursor: 'pointer', transition: 'all 0.25s ease',
                transform: active === p.id ? 'translateY(-4px)' : 'translateY(0)',
                boxShadow: active === p.id ? `0 12px 40px ${p.accent}22` : 'none',
              }}
            >
              {/* Product header */}
              <div style={{padding: '32px 24px 20px', textAlign: 'center' }}>
                <img
                  src={p.image}
                  alt={p.name}
                  style={{
                    width: '100%',
                    height: 180,
                    objectFit: 'cover',
                    borderRadius: 10,
                    marginBottom: 12,
                  }}
                />
                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{p.name}</h3>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {p.tags.map(t => (
                    <span key={t} style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 100,
                      background: p.accent + '18', color: p.accent,
                    }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Product body */}
              <div style={{ padding: '20px 24px 24px' }}>
                <p style={{ fontSize: 14, color: 'var(--ink-60)', lineHeight: 1.65, marginBottom: 16 }}>{p.desc}</p>

                {/* Sizes */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-30)', marginBottom: 10 }}>
                    Available Sizes
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {p.sizes.map(s => (
                      <div key={s.size} style={{
                        fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                        background: 'var(--cream)', border: '1px solid var(--ink-10)',
                        color: 'var(--ink-60)',
                      }}>
                        {s.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order CTA */}
                <a
                  href="/contact"
                  onClick={e => e.stopPropagation()}
                  style={{
                    display: 'block', textAlign: 'center', marginTop: 20,
                    background: p.accent, color: '#fff', padding: '11px',
                    borderRadius: 10, fontSize: 14, fontWeight: 600,
                    textDecoration: 'none', transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Order Now →
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Quality badge strip ── */}
      <section style={{ background: 'var(--green-900)', padding: '48px 24px' }}>
        <style>{`
          @media (max-width: 640px) {
            .badges-grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
        `}</style>
        <div
          className="badges-grid"
          style={{
            maxWidth: 800,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 24,
            textAlign: 'center',
          }}
        >
          {[
            { icon: <Leaf size={28} />, label: 'No Preservatives' },
            { icon: <Snowflake size={28} />, label: 'Always Fresh' },
            { icon: <Milk size={28} />, label: 'Farm Direct' },
            { icon: <BadgeCheck size={28} />, label: 'Quality Tested' },
          ].map(b => (
            <div key={b.label}>
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--green-600)', marginBottom: 8 }}>{b.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{b.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}