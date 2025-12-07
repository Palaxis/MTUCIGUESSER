import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import './Admin.css'

type Floor = {
  id: number
  name: string | null
  building: string | null
  level: string | null
  image_path: string
  width_px: number
  height_px: number
}

type Location = {
  id: number
  floor_id: number
  name: string | null
  image_path: string
  hint: string | null
  correct_x: number
  correct_y: number
  building?: string
  level?: string
}

export default function Admin() {
  const [floors, setFloors] = useState<Floor[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedFloor, setSelectedFloor] = useState<number | ''>('')
  const [floorImage, setFloorImage] = useState<File | null>(null)
  const [floorMeta, setFloorMeta] = useState({ name: '', building: '', level: '' })
  const [locationImage, setLocationImage] = useState<File | null>(null)
  const [hint, setHint] = useState('')
  const [locName, setLocName] = useState('')
  const mapRef = useRef<HTMLImageElement | null>(null)
  const [clickPos, setClickPos] = useState<{x:number,y:number}|null>(null)
  const [activeTab, setActiveTab] = useState<'floors' | 'locations'>('floors')

  useEffect(() => {
    loadFloors()
    loadLocations()
  }, [])

  function loadFloors() {
    axios.get('/api/floors').then(r => setFloors(r.data))
  }

  function loadLocations() {
    axios.get('/api/locations').then(r => setLocations(r.data))
  }

  function uploadFloor(e: React.FormEvent) {
    e.preventDefault()
    if (!floorImage) return
    const fd = new FormData()
    fd.append('image', floorImage)
    fd.append('name', floorMeta.name)
    fd.append('building', floorMeta.building)
    fd.append('level', floorMeta.level)
    axios.post('/api/floors', fd).then(r => {
      loadFloors()
      setFloorImage(null)
      setFloorMeta({ name: '', building: '', level: '' })
      alert('Floor created successfully!')
    }).catch(err => {
      alert('Error creating floor: ' + (err.response?.data?.error || err.message))
    })
  }

  async function deleteFloor(id: number) {
    if (!confirm('Are you sure you want to delete this floor? All associated locations will also be deleted.')) return
    try {
      await axios.delete(`/api/floors/${id}`)
      loadFloors()
      loadLocations()
      if (selectedFloor === id) setSelectedFloor('')
      alert('Floor deleted successfully!')
    } catch (err: any) {
      alert('Error deleting floor: ' + (err.response?.data?.error || err.message))
    }
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
      loadLocations()
      setLocationImage(null)
      setHint('')
      setLocName('')
      setClickPos(null)
      alert('Location created successfully!')
    }).catch(err => {
      alert('Error creating location: ' + (err.response?.data?.error || err.message))
    })
  }

  async function deleteLocation(id: number) {
    if (!confirm('Are you sure you want to delete this location?')) return
    try {
      await axios.delete(`/api/locations/${id}`)
      loadLocations()
      alert('Location deleted successfully!')
    } catch (err: any) {
      alert('Error deleting location: ' + (err.response?.data?.error || err.message))
    }
  }

  const filteredLocations = selectedFloor 
    ? locations.filter(loc => loc.floor_id === selectedFloor)
    : locations

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Админ панель MTUCI Guesser</h1>
        <div className="admin-tabs">
          <button 
            className={`admin-tab ${activeTab === 'floors' ? 'active' : ''}`}
            onClick={() => setActiveTab('floors')}
          >
            Этажи ({floors.length})
          </button>
          <button 
            className={`admin-tab ${activeTab === 'locations' ? 'active' : ''}`}
            onClick={() => setActiveTab('locations')}
          >
            Локации ({locations.length})
          </button>
        </div>
      </header>

      {activeTab === 'floors' && (
        <div className="admin-content">
          <section className="admin-section">
            <h2>Добавить новый этаж</h2>
            <form className="admin-form" onSubmit={uploadFloor}>
              <div className="form-row">
                <label>Название</label>
                <input 
                  type="text"
                  value={floorMeta.name} 
                  onChange={e => setFloorMeta({ ...floorMeta, name: e.target.value })} 
                  placeholder="Например: Главный корпус"
                />
              </div>
              <div className="form-row">
                <label>Здание</label>
                <input 
                  type="text"
                  value={floorMeta.building} 
                  onChange={e => setFloorMeta({ ...floorMeta, building: e.target.value })}
                  placeholder="Например: А"
                  required
                />
              </div>
              <div className="form-row">
                <label>Этаж</label>
                <input 
                  type="text"
                  value={floorMeta.level} 
                  onChange={e => setFloorMeta({ ...floorMeta, level: e.target.value })}
                  placeholder="Например: 1"
                  required
                />
              </div>
              <div className="form-row">
                <label>Карта этажа (PNG/JPG)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => setFloorImage(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <button type="submit" className="admin-btn-primary" disabled={!floorImage}>
                Создать этаж
              </button>
            </form>
          </section>

          <section className="admin-section">
            <h2>Все этажи</h2>
            {floors.length === 0 ? (
              <p className="admin-empty">Этажи еще не добавлены</p>
            ) : (
              <div className="admin-grid">
                {floors.map(floor => (
                  <div key={floor.id} className="admin-card">
                    <img 
                      src={floor.image_path} 
                      alt={`${floor.building} - ${floor.level}`}
                      className="admin-card-img"
                    />
                    <div className="admin-card-content">
                      <h3>{floor.name || 'Без названия'}</h3>
                      <p>Здание: {floor.building || '-'}</p>
                      <p>Этаж: {floor.level || '-'}</p>
                      <p className="admin-card-meta">
                        ID: {floor.id} | {floor.width_px}×{floor.height_px}px
                      </p>
                      <button 
                        className="admin-btn-delete"
                        onClick={() => deleteFloor(floor.id)}
                      >
                        🗑️ Удалить
                      </button>
                    </div>
        </div>
                ))}
        </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'locations' && (
        <div className="admin-content">
          <section className="admin-section">
            <h2>Добавить новую локацию</h2>
            <div className="admin-form">
              <div className="form-row">
                <label>Выберите этаж</label>
                <select 
                  value={selectedFloor} 
                  onChange={e => {
                    setSelectedFloor(e.target.value ? Number(e.target.value) : '')
                    setClickPos(null)
                  }}
                >
                  <option value="">-- Выберите этаж --</option>
                  {floors.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.building || 'Здание'} — {f.level || 'Этаж'}
                    </option>
                  ))}
          </select>
        </div>

        {selectedFloor && (
                <>
                  <div className="form-row">
                    <label>Кликните на карте где находится эта локация</label>
                    <div className="admin-map-container">
              <img
                ref={mapRef}
                        className="admin-map"
                src={floors.find(f => f.id === selectedFloor)!.image_path}
                alt="map"
                onClick={onMapClick}
              />
              {clickPos && (
                        <div 
                          className="admin-map-pin" 
                          style={{ 
                            left: `${(clickPos.x / floors.find(f => f.id === selectedFloor)!.width_px) * 100}%`, 
                            top: `${(clickPos.y / floors.find(f => f.id === selectedFloor)!.height_px) * 100}%` 
                          }} 
                        />
                      )}
                    </div>
                    {clickPos && (
                      <p className="admin-coords">
                        Координаты: X={clickPos.x}, Y={clickPos.y}
                      </p>
                    )}
                  </div>

                  <form onSubmit={uploadLocation}>
                    <div className="form-row">
                      <label>Название локации</label>
                      <input 
                        type="text"
                        value={locName} 
                        onChange={e => setLocName(e.target.value)}
                        placeholder="Например: Библиотека"
                      />
                    </div>
                    <div className="form-row">
                      <label>Подсказка (опционально)</label>
                      <input 
                        type="text"
                        value={hint} 
                        onChange={e => setHint(e.target.value)}
                        placeholder="Например: Здесь много книг"
                      />
                    </div>
                    <div className="form-row">
                      <label>Фотография локации</label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => setLocationImage(e.target.files?.[0] || null)}
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="admin-btn-primary" 
                      disabled={!locationImage || !clickPos || !selectedFloor}
                    >
                      Создать локацию
                    </button>
                  </form>
                </>
              )}
            </div>
          </section>

          <section className="admin-section">
            <h2>Все локации</h2>
            {selectedFloor && (
              <div className="admin-filter">
                <button 
                  className="admin-btn-filter active"
                  onClick={() => setSelectedFloor('')}
                >
                  Показать все ({locations.length})
                </button>
          </div>
        )}
            {locations.length === 0 ? (
              <p className="admin-empty">Локации еще не добавлены</p>
            ) : (
              <div className="admin-list">
                {filteredLocations.map(loc => (
                  <div key={loc.id} className="admin-list-item">
                    <img 
                      src={loc.image_path} 
                      alt={loc.name || 'Location'}
                      className="admin-list-img"
                    />
                    <div className="admin-list-content">
                      <h3>{loc.name || 'Без названия'}</h3>
                      <p>Этаж: {loc.building || '-'} — {loc.level || '-'}</p>
                      {loc.hint && <p className="admin-hint">💡 {loc.hint}</p>}
                      <p className="admin-list-meta">
                        ID: {loc.id} | Координаты: ({loc.correct_x}, {loc.correct_y})
                      </p>
          </div>
                    <button 
                      className="admin-btn-delete"
                      onClick={() => deleteLocation(loc.id)}
                    >
                      🗑️ Удалить
                    </button>
          </div>
                ))}
          </div>
            )}
          </section>
      </div>
      )}
    </div>
  )
}


