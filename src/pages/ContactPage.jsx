import { useState } from 'react'
import { Phone, MapPin, Clock } from 'lucide-react'

const CONTACT_INFO = [
  { icon: <Phone size={22} />, label: 'Phone / WhatsApp', value: '+255 655 763 844', href: 'tel:+255655763844' },
  { icon: <MapPin size={22} />, label: 'Location', value: 'Maduka Tisa Stand, Mwanza, Tanzania', href: 'https://maps.app.goo.gl/kRNAm4aguMB5Cnx26' },
  { icon: <Clock size={22} />, label: 'Working Hours', value: 'Monday – Saturday, 8:00am – 11:00pm', href: null },
]

export default function ContactPage() {
  const [form, setForm]       = useState({ name: '', phone: '', product: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    // Build WhatsApp message
    const text = encodeURIComponent(
      `Hello Bushi Dairy Farm! 🐄\n\n` +
      `Name: ${form.name}\n` +
      `Phone: ${form.phone}\n` +
      `Product of interest: ${form.product || 'General inquiry'}\n\n` +
      `Message: ${form.message}`
    )
    window.open(`https://wa.me/255655763844?text=${text}`, '_blank')
    setSubmitted(true)
  }

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(135deg, var(--green-900) 0%, #1a5c38 100%)', padding: '72px 24px 60px', textAlign: 'center', color: '#fff' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--green-400)', marginBottom: 12 }}>Get In Touch</p>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 16 }}>
          We'd love to hear from you.
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', maxWidth: 440, margin: '0 auto' }}>
          Order products, ask questions, or just say hello. We're always happy to connect.
        </p>
      </section>

      {/* ── Content ── */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>

        {/* Contact Info */}
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.3px' }}>Contact Information</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-60)', marginBottom: 32, lineHeight: 1.65 }}>
            Reach us directly via phone or WhatsApp. We respond quickly and are happy to take orders or answer any questions about our products.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
            {CONTACT_INFO.map(c => (
              <div key={c.label} style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
                background: 'var(--surface)', border: '1px solid var(--ink-10)',
                borderRadius: 12, padding: '16px 18px',
              }}>
                <span style={{ color: 'var(--green-600)', flexShrink: 0 }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-30)', marginBottom: 4 }}>{c.label}</div>
                  {c.href ? (
                    <a href={c.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: 'var(--green-600)', textDecoration: 'none' }}>{c.value}</a>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{c.value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp direct button */}
          <a
            href="https://wa.me/255655763844"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: '#25D366', color: '#fff',
              padding: '13px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700,
              textDecoration: 'none', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Chat on WhatsApp
          </a>
        </div>

        {/* Order Form */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--ink-10)', borderRadius: 16, padding: 32 }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Message Sent!</h3>
              <p style={{ fontSize: 14, color: 'var(--ink-60)', lineHeight: 1.65, marginBottom: 24 }}>
                Your inquiry has been sent via WhatsApp. We'll get back to you as soon as possible.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                style={{
                  background: 'var(--green-600)', color: '#fff', border: 'none',
                  padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
                }}
              >
                Send Another
              </button>
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Send an Inquiry</h3>
              <p style={{ fontSize: 13, color: 'var(--ink-60)', marginBottom: 24 }}>Fill in the form and we'll reach you via WhatsApp.</p>

              <form onSubmit={handleSubmit}>
                {[
                  { key: 'name',    label: 'Your Name',    placeholder: 'e.g. John Mwamba', type: 'text' },
                  { key: 'phone',   label: 'Phone Number', placeholder: '+255 7XX XXX XXX', type: 'tel' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-60)', marginBottom: 6 }}>{f.label}</label>
                    <input
                      type={f.type}
                      value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      required
                      className="w-full"
                    />
                  </div>
                ))}

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-60)', marginBottom: 6 }}>Product of Interest</label>
                  <select value={form.product} onChange={e => setForm(p => ({ ...p, product: e.target.value }))} className="w-full">
                    <option value="">Select a product…</option>
                    <option value="Fresh Milk">Fresh Milk</option>
                    <option value="Vanilla Yoghurt">Vanilla Yoghurt</option>
                    <option value="Strawberry Yoghurt">Strawberry Yoghurt</option>
                    <option value="Mtindi Bonge">Mtindi Bonge</option>
                    <option value="Multiple products">Multiple Products</option>
                  </select>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-60)', marginBottom: 6 }}>Message</label>
                  <textarea
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Tell us what you need — quantity, delivery, or any questions…"
                    rows={4}
                    required
                    style={{
                      width: '100%', border: '1.5px solid var(--ink-10)', borderRadius: 8,
                      padding: '8px 12px', fontSize: 13, background: 'var(--surface)',
                      color: 'var(--ink)', fontFamily: "'Outfit', sans-serif", resize: 'vertical',
                      outline: 'none',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--green-400)'}
                    onBlur={e => e.target.style.borderColor = 'var(--ink-10)'}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%', background: 'var(--green-600)', color: '#fff',
                    border: 'none', padding: '13px', borderRadius: 10,
                    fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Outfit', sans-serif", transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--green-800)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--green-600)'}
                >
                  Send via WhatsApp
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  )
}