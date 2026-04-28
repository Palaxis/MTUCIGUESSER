import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from '../shared/api'
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
  is_360?: number
  correct_x: number
  correct_y: number
  building?: string
  level?: string
}

export default function Admin() {
  const initialParams = new URLSearchParams(window.location.search)
  const [floors, setFloors] = useState<Floor[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [totalFloors, setTotalFloors] = useState(0)
  const [totalLocations, setTotalLocations] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedFloor, setSelectedFloor] = useState<number | ''>('')
  const [floorImage, setFloorImage] = useState<File | null>(null)
  const [floorMeta, setFloorMeta] = useState({ name: '', building: '', level: '' })
  const [editingFloorId, setEditingFloorId] = useState<number | null>(null)
  const [locationImage, setLocationImage] = useState<File | null>(null)
  const [hint, setHint] = useState('')
  const [locName, setLocName] = useState('')
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null)
  const mapRef = useRef<HTMLImageElement | null>(null)
  const [clickPos, setClickPos] = useState<{x:number,y:number}|null>(null)
  const [activeTab, setActiveTab] = useState<'floors' | 'locations' | 'locations360'>((initialParams.get('tab') as any) || 'floors')
  const [search, setSearch] = useState(initialParams.get('search') || '')
  const [sortBy, setSortBy] = useState(initialParams.get('sortBy') || 'id')
  const [sortDir, setSortDir] = useState(initialParams.get('sortDir') || 'desc')
  const [page, setPage] = useState(Number(initialParams.get('page') || 1))
  const pageSize = 12

  useEffect(() => {
    void loadData()
  }, [activeTab, search, sortBy, sortDir, page, selectedFloor])

  async function loadData() {
    setIsLoading(true)
    setError('')
    try {
      if (activeTab === 'floors') {
        const response = await apiClient.get('/api/floors', { params: { search, sortBy, sortDir, page, pageSize } })
        setFloors(response.data.items || [])
        setTotalFloors(response.data.total || 0)
      } else {
        const mode = activeTab === 'locations360' ? '360' : 'classic'
        const response = await apiClient.get('/api/locations', { params: { mode, search, sortBy, sortDir, page, pageSize, floorId: selectedFloor || undefined } })
        setLocations(response.data.items || [])
        setTotalLocations(response.data.total || 0)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', activeTab)
    params.set('search', search)
    params.set('sortBy', sortBy)
    params.set('sortDir', sortDir)
    params.set('page', String(page))
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [activeTab, search, sortBy, sortDir, page])

  async function loadFloorsReference() {
    const response = await apiClient.get('/api/floors', { params: { page: 1, pageSize: 300 } })
    setFloors(response.data.items || [])
  }

  useEffect(() => {
    void loadFloorsReference()
  }, [])

  function validateFloorForm() {
    if (!floorMeta.building.trim()) return 'Поле "Здание" обязательно'
    if (!floorMeta.level.trim()) return 'Поле "Этаж" обязательно'
    return ''
  }

  async function uploadFloor(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validateFloorForm()
    if (validationError) return alert(validationError)
    if (!floorImage && !editingFloorId) return alert('Нужно выбрать изображение')
    const fd = new FormData()
    if (floorImage) fd.append('image', floorImage)
    fd.append('name', floorMeta.name)
    fd.append('building', floorMeta.building)
    fd.append('level', floorMeta.level)
    const request = editingFloorId
      ? apiClient.put(`/api/floors/${editingFloorId}`, fd)
      : apiClient.post('/api/floors', fd)
    request.then(() => {
      void loadData()
      void loadFloorsReference()
      setFloorImage(null)
      setFloorMeta({ name: '', building: '', level: '' })
      setEditingFloorId(null)
      alert(editingFloorId ? 'Этаж обновлен!' : 'Этаж создан!')
    }).catch(err => {
      alert('Error creating floor: ' + (err.response?.data?.error || err.message))
    })
  }

  async function deleteFloor(id: number) {
    if (!confirm('Are you sure you want to delete this floor? All associated locations will also be deleted.')) return
    try {
      await apiClient.delete(`/api/floors/${id}`)
      void loadData()
      void loadFloorsReference()
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

  async function uploadLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!clickPos || !selectedFloor) return alert('Выберите этаж и координаты')
    if (!locationImage && !editingLocationId) return alert('Нужно выбрать изображение')
    const fd = new FormData()
    if (locationImage) fd.append('image', locationImage)
    fd.append('floor_id', String(selectedFloor))
    fd.append('x', String(clickPos.x))
    fd.append('y', String(clickPos.y))
    fd.append('name', locName)
    fd.append('hint', hint)
    fd.append('is_360', activeTab === 'locations360' ? '1' : '0')
    const request = editingLocationId
      ? apiClient.put(`/api/locations/${editingLocationId}`, fd)
      : apiClient.post('/api/locations', fd)
    request.then(() => {
      void loadData()
      setLocationImage(null)
      setHint('')
      setLocName('')
      setClickPos(null)
      setEditingLocationId(null)
      alert(editingLocationId ? 'Локация обновлена!' : 'Локация создана!')
    }).catch(err => {
      alert('Error creating location: ' + (err.response?.data?.error || err.message))
    })
  }

  async function deleteLocation(id: number) {
    if (!confirm('Are you sure you want to delete this location?')) return
    try {
      await apiClient.delete(`/api/locations/${id}`)
      void loadData()
      alert('Location deleted successfully!')
    } catch (err: any) {
      alert('Error deleting location: ' + (err.response?.data?.error || err.message))
    }
  }

  const totalPages = useMemo(() => {
    const total = activeTab === 'floors' ? totalFloors : totalLocations
    return Math.max(1, Math.ceil(total / pageSize))
  }, [activeTab, totalFloors, totalLocations])

  const visibleLocations = locations

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
            Локации ({locations.filter(l => !l.is_360).length})
          </button>
          <button
            className={`admin-tab ${activeTab === 'locations360' ? 'active' : ''}`}
            onClick={() => setActiveTab('locations360')}
          >
            Локации 360 ({locations.filter(l => !!l.is_360).length})
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
              <button type="submit" className="admin-btn-primary" disabled={!floorImage && !editingFloorId}>
                {editingFloorId ? 'Сохранить изменения' : 'Создать этаж'}
              </button>
              {editingFloorId && <button type="button" className="admin-btn-filter" onClick={() => { setEditingFloorId(null); setFloorMeta({ name: '', building: '', level: '' }); setFloorImage(null) }}>Отмена</button>}
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
                        className="admin-btn-filter"
                        onClick={() => {
                          setEditingFloorId(floor.id)
                          setFloorMeta({ name: floor.name || '', building: floor.building || '', level: floor.level || '' })
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        ✏️ Редактировать
                      </button>
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

      {(activeTab === 'locations' || activeTab === 'locations360') && (
        <div className="admin-content">
          <section className="admin-section">
            <h2>{activeTab === 'locations360' ? 'Добавить новую 360-локацию' : 'Добавить новую локацию'}</h2>
            <div className="admin-form">
              <div className="form-row">
                <label>Поиск / сортировка</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Поиск..." />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="id">ID</option>
                    <option value="name">Название</option>
                    <option value="building">Здание</option>
                    <option value="level">Этаж</option>
                  </select>
                  <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                    <option value="desc">desc</option>
                    <option value="asc">asc</option>
                  </select>
                </div>
              </div>
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
                      <label>{activeTab === 'locations360' ? 'Панорама 360 (equirectangular)' : 'Фотография локации'}</label>
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
            <h2>{activeTab === 'locations360' ? 'Все 360-локации' : 'Все локации'}</h2>
            {selectedFloor && <div className="admin-filter"><button className="admin-btn-filter active" onClick={() => setSelectedFloor('')}>Показать все</button></div>}
            {visibleLocations.length === 0 ? (
              <p className="admin-empty">Локации еще не добавлены</p>
            ) : (
              <div className="admin-list">
                {visibleLocations.map(loc => (
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
                    <button className="admin-btn-filter" onClick={() => {
                      setEditingLocationId(loc.id)
                      setLocName(loc.name || '')
                      setHint(loc.hint || '')
                      setSelectedFloor(loc.floor_id)
                      setClickPos({ x: loc.correct_x, y: loc.correct_y })
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}>
                      ✏️ Редактировать
                    </button>
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
      <section className="admin-section">
        <div className="admin-filter">
          <button className="admin-btn-filter" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>← Назад</button>
          <span>Страница {page} / {totalPages}</span>
          <button className="admin-btn-filter" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Вперед →</button>
        </div>
        {isLoading && <p className="admin-empty">Загрузка...</p>}
        {!!error && <p className="admin-empty">{error}</p>}
      </section>
    </div>
  )
}


