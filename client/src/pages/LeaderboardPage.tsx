import React, { useEffect, useState } from 'react'
import './LeaderboardPage.css'
import { ProfileMenu } from '../shared/ui'
import { leaderboardApi, LeaderboardPlayer } from '../shared/api'

interface Player extends LeaderboardPlayer {
  isCurrentUser?: boolean
}

interface LeaderboardPageProps {
  user: any
  userScore?: number
  userRank?: number
  isNewRecord?: boolean
  previousBest?: number
  onPlayAgain: () => void
  onNavigateToHome: () => void
  onNavigateToAccount?: () => void
  onLogout?: () => void
}

export default function LeaderboardPage({ user, userScore, userRank, isNewRecord, previousBest, onPlayAgain, onNavigateToHome, onNavigateToAccount, onLogout }: LeaderboardPageProps) {
  const initialParams = new URLSearchParams(window.location.search)
  const [players, setPlayers] = useState<Player[]>([])
  const [total, setTotal] = useState(0)
  const [hypotheticalRank, setHypotheticalRank] = useState<number | null>(null)
  const [search, setSearch] = useState(initialParams.get('search') || '')
  const [sortDir, setSortDir] = useState(initialParams.get('sortDir') || 'desc')
  const [page, setPage] = useState(Number(initialParams.get('page') || 1))
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    loadLeaderboard()
  }, [user, userScore, search, sortDir, page])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('search', search)
    params.set('sortDir', sortDir)
    params.set('page', String(page))
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [search, sortDir, page])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  async function loadLeaderboard() {
    try {
      const response = await leaderboardApi.getLeaderboard({ search, sortDir, page, pageSize })
      let leaderboardData = response.items
      setTotal(response.total)
      
      // Если есть счёт игрока (авторизованный или гость)
      if (userScore !== undefined) {
        // Для гостей: рассчитать гипотетический ранг
        if (!user) {
          const rank = calculateHypotheticalRank(leaderboardData, userScore)
          setHypotheticalRank(rank)
        } else {
          // Для авторизованных: отметить их строку по user_id
          leaderboardData = leaderboardData.map((player: Player) => ({
            ...player,
            isCurrentUser: player.user_id === user.id
          }))
        }
      }
      
      setPlayers(leaderboardData)
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
      setPlayers([])
    }
  }

  function calculateHypotheticalRank(leaderboard: Player[], score: number): number {
    // Найти позицию, куда бы попал игрок
    let rank = 1
    for (const player of leaderboard) {
      if (score >= player.score) {
        return rank
      }
      rank++
    }
    return rank
  }

  return (
    <div className="leaderboard-page">
      <header className="leaderboard-header">
        <div className="leaderboard-logo" onClick={onNavigateToHome}>
          <img src="/mtuci-logo-white.svg" alt="MTUCI" className="leaderboard-logo-icon" />
          <h1 className="leaderboard-logo-text">MTUCI Guesser</h1>
        </div>
        {user && onNavigateToAccount && onLogout ? (
          <ProfileMenu 
            variant="light"
            avatarUrl={user?.avatar_url}
            onNavigateToAccount={onNavigateToAccount}
            onLogout={onLogout}
          />
        ) : (
          <button className="leaderboard-profile-btn">
            <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
              <circle cx="12.5" cy="8" r="4" stroke="white" strokeWidth="2"/>
              <path d="M5 20C5 16 8 13 12.5 13C17 13 20 16 20 20" stroke="white" strokeWidth="2"/>
            </svg>
          </button>
        )}
      </header>

      <div className="leaderboard-content">
        <h2 className="leaderboard-title">Таблица результатов</h2>
        <div className="leaderboard-controls">
          <input
            className="leaderboard-control-input"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Поиск игрока..."
          />
          <select className="leaderboard-control-select" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
            <option value="desc">Сильные сверху</option>
            <option value="asc">Слабые сверху</option>
          </select>
        </div>

        <div className="leaderboard-table">
          <div className="leaderboard-row leaderboard-header-row">
            <div className="leaderboard-cell leaderboard-header-cell">Место</div>
            <div className="leaderboard-cell leaderboard-header-cell">Имя игрока</div>
            <div className="leaderboard-cell leaderboard-header-cell">Кол-во баллов</div>
          </div>
          {players.map((player) => (
            <div 
              key={player.user_id} 
              className={`leaderboard-row ${player.isCurrentUser ? 'leaderboard-row-highlight' : ''}`}
            >
              <div className="leaderboard-cell">{player.rank}</div>
              <div className="leaderboard-cell" title={player.name}>{player.name}</div>
              <div className="leaderboard-cell">{player.score}</div>
            </div>
          ))}
        </div>

        <div className="leaderboard-results">
          <p>Страница {page} / {totalPages}</p>
          <div className="leaderboard-pagination">
            <button
              className="leaderboard-page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Назад
            </button>
            <button
              className="leaderboard-page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Вперед
            </button>
          </div>
          {userScore && (
            <>
              <h3 className="leaderboard-user-score">
                Вы набрали {userScore} из 500 баллов
              </h3>
              
              {user && (
                <>
                  {isNewRecord ? (
                    <>
                      <p className="leaderboard-user-rank leaderboard-new-record">
                        🎉 Поздравляем! Это ваш новый рекорд!
                      </p>
                      {userRank && (
                        <p className="leaderboard-user-rank">
                          Вы заняли {userRank} место в рейтинге
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="leaderboard-user-rank leaderboard-not-record">
                        Вы не побили свой рекорд
                      </p>
                      {previousBest && (
                        <p className="leaderboard-user-rank">
                          Ваш лучший результат: {previousBest} баллов
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
              
              {!user && hypotheticalRank && (
                <p className="leaderboard-user-rank">
                  {hypotheticalRank <= players.length ? (
                    <>Вы бы заняли {hypotheticalRank} место, если бы были авторизованы</>
                  ) : (
                    <>Вы бы заняли {hypotheticalRank} место в топе, если бы были авторизованы</>
                  )}
                </p>
              )}
            </>
          )}

          <button className="leaderboard-play-again-btn" onClick={onPlayAgain}>
            Пройти заново
          </button>
        </div>
      </div>
    </div>
  )
}

