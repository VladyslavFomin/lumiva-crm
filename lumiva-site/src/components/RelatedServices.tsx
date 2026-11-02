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
        <div className="rel-svc">
          {items.map((item, i) => (
            <Link key={i} to={item.to}>
              <span className="n">{String(i + 1).padStart(2, '0')}<span aria-hidden="true">↗</span></span>
              <h4>{item.title}</h4>
              <p>{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
