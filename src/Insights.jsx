import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  Legend, CartesianGrid, ResponsiveContainer
} from 'recharts'
import * as ai from './lib/ai'
import { FACILITIES, MEDICINES, SERVICES } from './lib/data'
import { useStore, waiting } from './lib/store'
import { can } from './lib/security'
import { Tile } from './ui'

const load = async name => {
  const response = await fetch(`/data/${name}.csv`)
  if (!response.ok) throw new Error(`Could not load /data/${name}.csv`)
  return ai.parseCSV(await response.text())
}

const average = values =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

const mostCommon = values => {
  const counts = values.reduce((out, value) => {
    out[value] = (out[value] || 0) + 1
    return out
  }, {})
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'consult'
}

function trainModels({ queueRows, stockRows }, seed) {
  const [queueTrain, queueTest] = ai.split(queueRows, 0.8, seed)
  const queueWeights = ai.fitLinear(
    queueTrain.map(ai.waitX),
    queueTrain.map(row => row.wait_min)
  )
  const queuePredictions = queueTest.map(row =>
    ai.predictLinear(queueWeights, ai.waitX(row))
  )

  const [stockTrain, stockTest] = ai.split(stockRows, 0.8, seed)
  const stockWeights = ai.fitLogistic(
    stockTrain.map(ai.stockX),
    stockTrain.map(row => row.stockout_7d)
  )
  const stockPredictions = stockTest.map(row =>
    ai.predictProb(stockWeights, ai.stockX(row))
  )

  return {
    queue: {
      weights: queueWeights,
      metrics: ai.regMetrics(queueTest.map(row => row.wait_min), queuePredictions),
      trainingCount: queueTrain.length,
      totalCount: queueRows.length
    },
    stock: {
      weights: stockWeights,
      metrics: ai.clsMetrics(stockTest.map(row => row.stockout_7d), stockPredictions),
      trainingCount: stockTrain.length,
      totalCount: stockRows.length
    },
    queueRows,
    stockRows
  }
}

const formatPercent = value => `${Math.round(value * 100)}%`

export default function Insights() {
  const s = useStore()
  const canTrain = can(s.perms, s.role, 'analytics', 'write')
  const [datasets, setDatasets] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('queue')
  const [seed, setSeed] = useState(7)

  useEffect(() => {
    let active = true
    Promise.all([load('queue_wait'), load('stock_levels')])
      .then(([queueRows, stockRows]) => {
        if (active) setDatasets({ queueRows, stockRows })
      })
      .catch(err => {
        if (active) setError(`${err.message}. Check that public/data/queue_wait.csv and public/data/stock_levels.csv exist.`)
      })
    return () => { active = false }
  }, [])

  const model = useMemo(
    () => datasets ? trainModels(datasets, seed) : null,
    [datasets, seed]
  )

  const liveQueue = useMemo(() => {
    return FACILITIES.map(facility => {
      const activeTickets = (s.queue || []).filter(ticket =>
        ticket.facility === facility.id &&
        ['waiting', 'called'].includes(ticket.status)
      )
      const waitingCount = waiting(s, facility.id).length
      const service = mostCommon(activeTickets.map(ticket => ticket.service))
      const currentHour = new Date().getHours()
      const weekend = [0, 6].includes(new Date().getDay()) ? 1 : 0
      const prediction = model
        ? Math.max(0, ai.predictLinear(model.queue.weights, ai.waitX({
            queue_ahead: waitingCount + 1,
            staff: facility.staff,
            hour: currentHour,
            weekend,
            service,
            facility_type: facility.type
          })))
        : 0

      return {
        id: facility.id,
        facility: facility.name,
        town: facility.town,
        waiting: waitingCount,
        active: activeTickets.length,
        predictedWait: Math.round(prediction),
        service
      }
    })
  }, [s.queue, model])

  const liveStockRisk = useMemo(() => {
    if (!model) return []
    const rows = []
    for (const facility of FACILITIES) {
      for (const medicine of MEDICINES) {
        const quantity = Number(s.stock?.[facility.id]?.[medicine.id] ?? 0)
        const historical = model.stockRows.filter(row => row.medicine === medicine.id)
        const dailyDispense = average(historical.map(row => row.daily_dispense)) || 1
        const historicalDays = average(historical.map(row => row.days_since_restock))
        const updatedAt = s.stockUpdatedAt?.[facility.id]?.[medicine.id]
        const daysSinceRestock = updatedAt
          ? Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 86400000)
          : historicalDays
        const probability = ai.predictProb(model.stock.weights, ai.stockX({
          stock: quantity,
          daily_dispense: dailyDispense,
          days_since_restock: daysSinceRestock
        }))

        rows.push({
          facility: facility.name,
          medicine: medicine.name,
          quantity,
          dailyDispense: +dailyDispense.toFixed(1),
          daysSinceRestock: +daysSinceRestock.toFixed(1),
          probability
        })
      }
    }
    return rows.sort((a, b) => b.probability - a.probability)
  }, [model, s.stock, s.stockUpdatedAt])

  const serviceCounts = useMemo(() => SERVICES.map(service => ({
    service: service.name,
    bookings: (s.queue || []).filter(ticket => ticket.service === service.id).length
  })), [s.queue])

  const queueTotal = (s.queue || []).length
  const waitingTotal = (s.queue || []).filter(ticket => ticket.status === 'waiting').length
  const completedTotal = (s.queue || []).filter(ticket => ticket.status === 'completed').length
  const stockItems = FACILITIES.length * MEDICINES.length
  const outOfStock = FACILITIES.reduce((count, facility) =>
    count + MEDICINES.filter(medicine =>
      Number(s.stock?.[facility.id]?.[medicine.id] ?? 0) === 0
    ).length, 0)

  if (error) return <p className="card bad">{error}</p>
  if (!model) return <p className="card">Loading queue_wait.csv and stock_levels.csv and training the AI models…</p>

  const queueMetrics = model.queue.metrics
  const stockMetrics = model.stock.metrics

  return (
    <>
      <div className="tiles">
        <Tile label="Queue bookings in this system" value={queueTotal} />
        <Tile label="Currently waiting" value={waitingTotal} />
        <Tile label="Completed tickets" value={completedTotal} />
        <Tile label="Out-of-stock medicine entries" value={`${outOfStock}/${stockItems}`} />
      </div>

      <div className="tabs sub">
        <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>Live queue insights</button>
        <button className={tab === 'wait' ? 'on' : ''} onClick={() => setTab('wait')}>AI queue-wait prediction</button>
        <button className={tab === 'stock' ? 'on' : ''} onClick={() => setTab('stock')}>AI stock-level prediction</button>
        {canTrain && <button className="ghost" onClick={() => setSeed(value => value + 1)}>Retrain AI</button>}
      </div>

      {tab === 'queue' && (
        <section className="card">
          <h2>Live queue activity</h2>
          <p className="muted">These figures come from queue bookings and ticket status changes made in MediQueue, not fixed chart values.</p>
          <div className="tiles">
            <Tile label="Total bookings" value={queueTotal} />
            <Tile label="Waiting now" value={waitingTotal} />
            <Tile label="Completed" value={completedTotal} />
          </div>
          <h3>Current queue by facility</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={liveQueue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="town" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="waiting" name="Waiting tickets" />
              <Bar dataKey="active" name="Waiting + called" />
            </BarChart>
          </ResponsiveContainer>
          <h3>Bookings by service</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={serviceCounts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="service" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="bookings" name="Actual bookings" />
            </BarChart>
          </ResponsiveContainer>
          <h3>Facility activity and AI wait estimate</h3>
          <div className="scroll">
            <table>
              <thead><tr><th>Facility</th><th>Waiting now</th><th>Active tickets</th><th>AI estimate for next ticket</th></tr></thead>
              <tbody>{liveQueue.map(row => (
                <tr key={row.id}>
                  <td>{row.facility}<br /><span className="muted">{row.town}</span></td>
                  <td>{row.waiting}</td>
                  <td>{row.active}</td>
                  <td>{row.predictedWait} minutes</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'wait' && (
        <section className="card">
          <h2>AI: patient queue waiting-time prediction</h2>
          <p className="muted">The model is trained using public/data/queue_wait.csv. For live predictions, it reads the actual waiting tickets, facility staffing, service mix and current time from MediQueue.</p>
          <div className="tiles">
            <Tile label="Training records" value={model.queue.trainingCount.toLocaleString()} />
            <Tile label="Mean absolute error" value={`${queueMetrics.mae.toFixed(1)} min`} />
            <Tile label="R² on test records" value={queueMetrics.r2.toFixed(2)} />
          </div>
          <h3>Live AI estimate by facility</h3>
          <div className="scroll">
            <table>
              <thead><tr><th>Facility</th><th>People waiting</th><th>Service mix</th><th>Predicted wait for next ticket</th></tr></thead>
              <tbody>{liveQueue.map(row => (
                <tr key={row.id}><td>{row.facility}</td><td>{row.waiting}</td><td>{SERVICES.find(item => item.id === row.service)?.name || row.service}</td><td>{row.predictedWait} minutes</td></tr>
              ))}</tbody>
            </table>
          </div>
          <h3>How the model performs on unseen dataset records</h3>
          <p>Mean absolute error measures the average difference between predicted and recorded waiting time. R² measures how much variation in the test data the model explains.</p>
          <p className="muted">Training file: queue_wait.csv ({model.queue.totalCount.toLocaleString()} records). Live prediction inputs are refreshed from the current application state.</p>
        </section>
      )}

      {tab === 'stock' && (
        <section className="card">
          <h2>AI: medicine stock-out risk prediction</h2>
          <p className="muted">The model is trained using public/data/stock_levels.csv. Predictions use current medicine quantities from the pharmacist's stock updates. Daily dispensing rates are estimated from the matching medicine records in the training dataset.</p>
          <div className="tiles">
            <Tile label="Training records" value={model.stock.trainingCount.toLocaleString()} />
            <Tile label="Test accuracy" value={formatPercent(stockMetrics.acc)} />
            <Tile label="Precision" value={formatPercent(stockMetrics.precision)} />
            <Tile label="Recall" value={formatPercent(stockMetrics.recall)} />
          </div>
          <h3>Live stock-out risk</h3>
          <div className="scroll">
            <table>
              <thead><tr><th>Facility</th><th>Medicine</th><th>Current units</th><th>Estimated daily use</th><th>Days since update</th><th>Risk within 7 days</th></tr></thead>
              <tbody>{liveStockRisk.slice(0, 15).map((row, index) => (
                <tr key={`${row.facility}-${row.medicine}-${index}`}>
                  <td>{row.facility}</td><td>{row.medicine}</td><td>{row.quantity}</td>
                  <td>{row.dailyDispense}</td><td>{row.daysSinceRestock}</td>
                  <td>{formatPercent(row.probability)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="muted">Stock quantities come directly from the live application state. If a pharmacist changes stock, the prediction recalculates. Days since stock update uses the application's stock update timestamp; if no update exists yet, the model uses the matching medicine's historical dataset average.</p>
        </section>
      )}
    </>
  )
}
