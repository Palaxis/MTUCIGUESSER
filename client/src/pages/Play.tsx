import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

type Floor = {
  id: number
  name: string | null
  building: string | null
  level: string | null
  image_path: string
  width_px: number
  height_px: number
}

type LocationForGame = {
  id: number
  floor_id: number
  image_path: string
  hint: string | null
}

export default function Play() {
  const [floors, setFloors] = useState<Floor[]>([])
  const [current, setCurrent] = useState<{ location: LocationForGame, floor: Floor } | null>(null)
  const [guess, setGuess] = useState<{x:number, y:number} | null>(null)
  const [result, setResult] = useState<any>(null)
  const mapRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    axios.get('/api/floors').then(r => setFloors(r.data))
  }, [])

  function loadRandom(floorId?: number) {
    setGuess(null)
    setResult(null)
    const params = floorId ? { params: { floor_id: floorId } } : undefined
    axios.get('/api/locations/random', params).then(r => setCurrent(r.data))
  }

  function onMapClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!current || !mapRef.current) return
    const rect = mapRef.current.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) * (current.floor.width_px / rect.width))
    const y = Math.round((e.clientY - rect.top) * (current.floor.height_px / rect.height))
    setGuess({ x, y })
  }

  function submitGuess() {
    if (!current || !guess) return
    axios.post('/api/guess', {
      location_id: current.location.id,
      guess_x: guess.x,
      guess_y: guess.y
    }).then(r => setResult(r.data))
  }

  return (
    <div className="page">
      <div className="controls">
        <select onChange={e => loadRandom(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Random floor</option>
          {floors.map(f => (
            <option key={f.id} value={f.id}>{f.building || 'Building'} — {f.level || 'Level'}</option>
          ))}
        </select>
        <button onClick={() => loadRandom()}>New random</button>
      </div>

      {current && (
        <div className="game">
          <div className="prompt">
            <img className="prompt-image" src={current.location.image_path} alt="spot" />
            {current.location.hint && <div className="hint">Hint: {current.location.hint}</div>}
          </div>
          <div className="map-wrap">
            <div className="map-inner">
              <img
                ref={mapRef}
                className="map"
                src={current.floor.image_path}
                alt="map"
                onClick={onMapClick}
              />
              {guess && (
                <div
                  className="pin guess"
                  style={{ left: `${(guess.x / current.floor.width_px) * 100}%`, top: `${(guess.y / current.floor.height_px) * 100}%` }}
                />
              )}
              {result && (
                <div
                  className="pin answer"
                  style={{ left: `${(result.correct_x / current.floor.width_px) * 100}%`, top: `${(result.correct_y / current.floor.height_px) * 100}%` }}
                />
              )}
            </div>
            <div className="actions">
              <button disabled={!guess} onClick={submitGuess}>Submit guess</button>
              {result && (
                <div className="result">Score: {result.score} — Distance: {Math.round(result.distance)} px {result.correct ? '✓' : '✗'}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


