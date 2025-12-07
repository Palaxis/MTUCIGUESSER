import React from 'react'
import './RulesPage.css'

interface RulesPageProps {
  onClose: () => void
}

export default function RulesPage({ onClose }: RulesPageProps) {
  return (
    <div className="rules-page">
      <div className="rules-background">
        <div className="rules-circle rules-circle-1"></div>
        <div className="rules-circle rules-circle-2"></div>
        <div className="rules-circle rules-circle-3"></div>
      </div>

      <div className="rules-modal">
        <h2 className="rules-title">Правила игры</h2>

        <div className="rules-text">
          В ходе игры вам будут представлены фотографии различных мест внутри главного корпуса МТУСИ. 
          Ваша задача – угадать, где сделано фото, выбрав этаж и точку на карте. Фотографию можно переключать 
          с помощью стрелок, расположенных по бокам кадра. После выбора конкретного места нажмите кнопку «Готово». 
          Появится окно с вашим ответом, правильным ответом и количеством заработанных баллов. Затем нажмите 
          «Следующий раунд», чтобы перейти к следующему фото. После завершения всех раундов вы увидите итоговое 
          количество баллов и своё место в рейтинге. Вы можете начать игру заново, нажав «Пройти заново» – 
          при этом предыдущий результат будет сброшен. Максимальное количество – 100 баллов за один раунд. 
          Баллы начисляются в зависимости от точности вашего ответа: в случае выбора неверного этажа вы получаете 
          только 10 баллов, а за полностью правильный ответ – 100 баллов.
        </div>

        <button className="rules-close-btn" onClick={onClose}>
          Прочитал
        </button>
      </div>
    </div>
  )
}


