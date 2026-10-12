import { Link } from 'react-router-dom'

interface RelatedServiceItem {
  title: string
  desc: string
  to: string
}

interface RelatedServicesProps {
  num: string
  tag: string
  heading: string
  items: RelatedServiceItem[]
}

export default function RelatedServices({ num, tag, heading, items }: RelatedServicesProps) {
  return (
    <section>
      <div className="wrap">
        <div className="sec-head">
          <div className="sec-tag"><span className="num">{num}</span>{tag}</div>
          <div><h2 className="sec-title">{heading}</h2></div>
        </div>
        <div className="deliv">
          {items.map((item, i) => (
            <Link key={i} to={item.to} className="deliv-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, width: '100%' }}>
                <div><h4>{item.title}</h4><p>{item.desc}</p></div>
                <span style={{ color: 'var(--muted)', fontSize: 18, flexShrink: 0, marginTop: 6 }}>↗</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
