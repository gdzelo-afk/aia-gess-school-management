import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { fonts } from './data';
export function Typography() {
  const [left, setLeft] = useState('mersad');
  const [right, setRight] = useState('antena');
  const [size, setSize] = useState(14);
  const [weight, setWeight] = useState(400);
  const [dark, setDark] = useState(false);
  const [sample, setSample] = useState('სკოლა მოძრაობაში.');
  return (
    <div className="dl-root dl-type-page dl-a" data-lab-theme={dark ? 'dark' : 'light'}>
      <header>
        <Link to="/design-lab">
          <ArrowLeft size={16} /> მიმართულებები
        </Link>
        <span>ტიპოგრაფიის ლაბორატორია</span>
        <button className="dl-icon" aria-label="თემის შეცვლა" onClick={() => setDark(!dark)}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>
      <main>
        <div className="dl-type-title">
          <span className="dl-eyebrow">12 კანდიდატი / არცერთი საბოლოო არჩევანი</span>
          <h1>ქართული, სამუშაო გარემოში.</h1>
          <p>შეადარეთ ფორმა, რიტმი და წაკითხვადობა რეალურ ზომებში.</p>
        </div>
        <div className="dl-type-controls">
          <label>
            სამუშაო ტექსტის ზომა
            <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {[12, 13, 14, 16, 20, 24, 32, 64].map((n) => (
                <option value={n} key={n}>
                  {n}px
                </option>
              ))}
            </select>
          </label>
          <label>
            ცვლადი შრიფტის წონა
            <input
              type="range"
              min="100"
              max="700"
              step="50"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
            />
            <span>{weight}</span>
          </label>
          <label>
            სათაურის ტექსტი
            <input value={sample} onChange={(e) => setSample(e.target.value)} />
          </label>
        </div>
        <div className="dl-type-comparison">
          {[
            [left, setLeft],
            [right, setRight],
          ].map(([id, setter], index) => {
            const f = fonts.find((f) => f.id === id)!;
            return (
              <section key={index}>
                <select
                  aria-label={index ? 'მარჯვენა შრიფტი' : 'მარცხენა შრიფტი'}
                  value={id as string}
                  onChange={(e) => (setter as typeof setLeft)(e.target.value)}
                >
                  {fonts.map((f) => (
                    <option value={f.id} key={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <div
                  className="dl-type-specimen"
                  style={
                    {
                      fontFamily: `"DL-${f.id}", sans-serif`,
                      fontSize: size,
                      fontWeight: f.axes.startsWith('wght') ? weight : 400,
                    } as CSSProperties
                  }
                >
                  <span className="dl-specimen-nav">
                    <span>მიმოხილვა</span>
                    <span>მოსწავლეები</span>
                    <span>ჟურნალი</span>
                  </span>
                  <h2>{sample}</h2>
                  <p>
                    ერთიანი ხედვა. გააზრებული გადაწყვეტილებები. სკოლის ყოველდღიურობა, ადამიანები და
                    შესაძლებლობები.
                  </p>
                  <div className="dl-specimen-form">
                    <input aria-label={`${f.name} — სახელი`} defaultValue="ელენე მაისურაძე" />
                    <button>გაგრძელება →</button>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>მოსწავლე</th>
                        <th>კლასი</th>
                        <th>ქულა</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>სალომე კვარაცხელია</td>
                        <td>VIII ა</td>
                        <td>10</td>
                      </tr>
                      <tr>
                        <td>ნიკოლოზ გელაშვილი</td>
                        <td>VII ა</td>
                        <td>8</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="dl-specimen-numbers">01 02 03 04 05 06 07 08 09 10</div>
                  <p>
                    1 250.00 ₾ · GEL · AIA-GESS
                    <br />
                    28 სექტემბერი, 2026 · 09:45
                  </p>
                  <div className="dl-specimen-cells">
                    {[8, 9, 10, 7, 10].map((n, i) => (
                      <span key={i}>{n}</span>
                    ))}
                  </div>
                </div>
                <footer>
                  <strong>{f.kind}</strong>
                  <p>{f.note}</p>
                  <small>{f.axes}</small>
                </footer>
              </section>
            );
          })}
        </div>
        <div className="dl-type-scale">
          <h2>ზომების ტესტი</h2>
          {[12, 13, 14, 16, 20, 24, 32, 64].map((n) => (
            <div key={n}>
              <span>{n}px</span>
              <p style={{ fontFamily: `"DL-${left}",sans-serif`, fontSize: n }}>
                ელენე მაისურაძე · 28 სექტემბერი · 10
              </p>
            </div>
          ))}
        </div>
        <section className="dl-font-catalog">
          <h2>კვლევის სრული სია</h2>
          <div>
            {fonts.map((f) => (
              <button key={f.id} onClick={() => setRight(f.id)}>
                <span>
                  {f.name}
                  <small>{f.kind}</small>
                </span>
                <strong style={{ fontFamily: `"DL-${f.id}",sans-serif` }}>შემდეგი დღე. 0123</strong>
                <p>{f.note}</p>
                <small>{f.axes}</small>
              </button>
            ))}
          </div>
        </section>
        <footer className="dl-type-footnote">
          წყარო:{' '}
          <a href="https://typeface.ge/" target="_blank" rel="noreferrer">
            Typeface.ge
          </a>
          . ადგილობრივი კვლევის ნიმუშები. წარმოებაში გამოყენებამდე თითოეული შრიფტის ლიცენზია
          გადასამოწმებელია.
        </footer>
      </main>
    </div>
  );
}
