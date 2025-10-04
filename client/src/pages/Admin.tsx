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

export default function Admin() {
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloor, setSelectedFloor] = useState<number | ''>('')
  const [floorImage, setFloorImage] = useState<File | null>(null)
  const [floorMeta, setFloorMeta] = useState({ name: '', building: '', level: '' })
  const [locationImage, setLocationImage] = useState<File | null>(null)
  const [hint, setHint] = useState('')
  const [locName, setLocName] = useState('')
  const mapRef = useRef<HTMLImageElement | null>(null)
  const [clickPos, setClickPos] = useState<{x:number,y:number}|null>(null)

  useEffect(() => {
    axios.get('/api/floors').then(r => setFloors(r.data))
  }, [])

  function uploadFloor(e: React.FormEvent) {
    e.preventDefault()
    if (!floorImage) return
    const fd = new FormData()
    fd.append('image', floorImage)
    fd.append('name', floorMeta.name)
    fd.append('building', floorMeta.building)
    fd.append('level', floorMeta.level)
    axios.post('/api/floors', fd).then(r => {
      setFloors(prev => [r.data, ...prev])
      setFloorImage(null)
      setFloorMeta({ name: '', building: '', level: '' })
    })
  }

  function onMapClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!mapRef.current || !selectedFloor) return
    const floor = floors.find(f => f.id === selectedFloor)!
    const rect = mapRef.current.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) * (floor.width_px / rect.width))
    const y = Math.round((e.clientY - rect.top) * (floor.height_px / rect.height))
    setClickPos({ x, y })
  }

  function uploadLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!locationImage || !clickPos || !selectedFloor) return
    const fd = new FormData()
    fd.append('image', locationImage)
    fd.append('floor_id', String(selectedFloor))
    fd.append('x', String(clickPos.x))
    fd.append('y', String(clickPos.y))
    fd.append('name', locName)
    fd.append('hint', hint)
    axios.post('/api/locations', fd).then(() => {
      setLocationImage(null)
      setHint('')
      setLocName('')
      setClickPos(null)
    })
  }

  return (
    <div className="page">
      <h2>Floors</h2>
      <form className="card" onSubmit={uploadFloor}>
        <div className="row">
          <label>Name</label>
          <input value={floorMeta.name} onChange={e => setFloorMeta({ ...floorMeta, name: e.target.value })} />
        </div>
        <div className="row">
          <label>Building</label>
          <input value={floorMeta.building} onChange={e => setFloorMeta({ ...floorMeta, building: e.target.value })} />
        </div>
        <div className="row">
          <label>Level</label>
          <input value={floorMeta.level} onChange={e => setFloorMeta({ ...floorMeta, level: e.target.value })} />
        </div>
        <div className="row">
          <label>Image</label>
          <input type="file" accept="image/*" onChange={e => setFloorImage(e.target.files?.[0] || null)} />
        </div>
        <button type="submit" disabled={!floorImage}>Upload floor</button>
      </form>

      <h2>Locations</h2>
      <div className="card">
        <div className="row">
          <label>Floor</label>
          <select value={selectedFloor} onChange={e => setSelectedFloor(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Select floor</option>
            {floors.map(f => <option key={f.id} value={f.id}>{f.building || 'Building'} — {f.level || 'Level'}</option>)}
          </select>
        </div>
        {selectedFloor && (
          <div className="map-wrap">
            <div className="map-inner">
              <img
                ref={mapRef}
                className="map"
                src={floors.find(f => f.id === selectedFloor)!.image_path}
                alt="map"
                onClick={onMapClick}
              />
              {clickPos && (
                <div className="pin guess" style={{ left: `${(clickPos.x / floors.find(f => f.id === selectedFloor)!.width_px) * 100}%`, top: `${(clickPos.y / floors.find(f => f.id === selectedFloor)!.height_px) * 100}%` }} />
              )}
            </div>
          </div>
        )}

        <form onSubmit={uploadLocation}>
          <div className="row">
            <label>Name</label>
            <input value={locName} onChange={e => setLocName(e.target.value)} />
          </div>
          <div className="row">
            <label>Hint</label>
            <input value={hint} onChange={e => setHint(e.target.value)} />
          </div>
          <div className="row">
            <label>Location photo</label>
            <input type="file" accept="image/*" onChange={e => setLocationImage(e.target.files?.[0] || null)} />
          </div>
          <button type="submit" disabled={!locationImage || !clickPos || !selectedFloor}>Upload location</button>
        </form>
      </div>
    </div>
  )
}


