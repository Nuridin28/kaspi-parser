import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { schedulerApi, type SchedulerConfig } from '@/lib/api'
import { 
  Clock, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Save,
  RefreshCw,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Scheduler() {
  const [configs, setConfigs] = useState<SchedulerConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [nextRuns, setNextRuns] = useState<Record<string, string | null>>({})

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      setIsLoading(true)
      const data = await schedulerApi.list()
      
      const defaultJobs = ['daily_price_update', 'daily_analytics_aggregation']
      const existingJobIds = new Set(data.map(c => c.job_id))
      
      const allConfigs = [...data]
      
      for (const jobId of defaultJobs) {
        if (!existingJobIds.has(jobId)) {
          try {
            const config = await schedulerApi.get(jobId)
            allConfigs.push(config)
          } catch (error) {
            console.error(`Failed to get/create config for ${jobId}:`, error)
          }
        }
      }
      
      setConfigs(allConfigs)
      
      for (const config of allConfigs) {
        try {
          const nextRun = await schedulerApi.getNextRun(config.job_id)
          setNextRuns(prev => ({
            ...prev,
            [config.job_id]: nextRun.next_run_time
          }))
        } catch (error) {
          console.error(`Failed to get next run for ${config.job_id}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to load scheduler configs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async (config: SchedulerConfig, updates: Partial<SchedulerConfig>) => {
    try {
      setIsSaving(config.job_id)
      const updated = await schedulerApi.update(config.job_id, updates)
      setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c))
      
      // Обновляем время следующего запуска
      const nextRun = await schedulerApi.getNextRun(config.job_id)
      setNextRuns(prev => ({
        ...prev,
        [config.job_id]: nextRun.next_run_time
      }))
    } catch (error) {
      console.error('Failed to update scheduler config:', error)
      alert('Ошибка при обновлении настроек')
    } finally {
      setIsSaving(null)
    }
  }

  const formatNextRun = (nextRunTime: string | null) => {
    if (!nextRunTime) return 'Не запланировано'
    const date = new Date(nextRunTime)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getJobName = (jobId: string) => {
    const names: Record<string, string> = {
      'daily_price_update': 'Автоматический парсинг цен',
      'daily_analytics_aggregation': 'Агрегация аналитики'
    }
    return names[jobId] || jobId
  }

  const getJobDescription = (jobId: string) => {
    const descriptions: Record<string, string> = {
      'daily_price_update': 'Периодический парсинг цен товаров. Старые данные сохраняются в историю.',
      'daily_analytics_aggregation': 'Агрегация ежедневной аналитики по ценам товаров.'
    }
    return descriptions[jobId] || ''
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Загрузка настроек...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="h-8 w-8" />
          Управление расписанием
        </h2>
        <p className="text-muted-foreground">
          Настройте интервалы автоматического парсинга товаров
        </p>
      </div>

      <div className="grid gap-6">
        {configs.map((config) => (
          <SchedulerCard
            key={config.id}
            config={config}
            nextRunTime={nextRuns[config.job_id] || null}
            isSaving={isSaving === config.job_id}
            onUpdate={(updates) => handleUpdate(config, updates)}
            jobName={getJobName(config.job_id)}
            jobDescription={getJobDescription(config.job_id)}
          />
        ))}
      </div>

      {configs.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Нет настроек расписания</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface SchedulerCardProps {
  config: SchedulerConfig
  nextRunTime: string | null
  isSaving: boolean
  onUpdate: (updates: Partial<SchedulerConfig>) => void
  jobName: string
  jobDescription: string
}

function SchedulerCard({
  config,
  nextRunTime,
  isSaving,
  onUpdate,
  jobName,
  jobDescription
}: SchedulerCardProps) {
  const [enabled, setEnabled] = useState(config.enabled)
  const [intervalHours, setIntervalHours] = useState(config.interval_hours.toString())
  const [intervalMinutes, setIntervalMinutes] = useState(config.interval_minutes.toString())
  const [cronHour, setCronHour] = useState(config.cron_hour?.toString() || '')
  const [cronMinute, setCronMinute] = useState(config.cron_minute?.toString() || '')
  const [useInterval, setUseInterval] = useState(config.job_id === 'daily_price_update')

  const handleSave = () => {
    const updates: Partial<SchedulerConfig> = {
      enabled,
    }

    if (useInterval && config.job_id === 'daily_price_update') {
      updates.interval_hours = parseInt(intervalHours) || 0
      updates.interval_minutes = parseInt(intervalMinutes) || 0
      updates.cron_hour = null
      updates.cron_minute = null
    } else {
      if (cronHour && cronMinute) {
        updates.cron_hour = parseInt(cronHour)
        updates.cron_minute = parseInt(cronMinute)
      }
      updates.interval_hours = null
      updates.interval_minutes = null
    }

    onUpdate(updates)
  }

  const formatNextRun = (nextRunTime: string | null) => {
    if (!nextRunTime) return 'Не запланировано'
    const date = new Date(nextRunTime)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {enabled ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              {jobName}
            </CardTitle>
            <CardDescription className="mt-2">{jobDescription}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">Включено</span>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {nextRunTime && enabled && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Следующий запуск</p>
              <p className="text-sm font-medium">{formatNextRun(nextRunTime)}</p>
            </div>
          </div>
        )}

        {config.job_id === 'daily_price_update' && (
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={useInterval}
                  onChange={() => setUseInterval(true)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Интервал (часы и минуты)</span>
              </label>
            </div>
            {useInterval && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor={`hours-${config.id}`}>Часы</Label>
                  <Input
                    id={`hours-${config.id}`}
                    type="number"
                    min="0"
                    value={intervalHours}
                    onChange={(e) => setIntervalHours(e.target.value)}
                    placeholder="24"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`minutes-${config.id}`}>Минуты</Label>
                  <Input
                    id={`minutes-${config.id}`}
                    type="number"
                    min="0"
                    max="59"
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!useInterval}
                  onChange={() => setUseInterval(false)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Cron (конкретное время)</span>
              </label>
            </div>
            {!useInterval && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor={`cron-hour-${config.id}`}>Час (0-23)</Label>
                  <Input
                    id={`cron-hour-${config.id}`}
                    type="number"
                    min="0"
                    max="23"
                    value={cronHour}
                    onChange={(e) => setCronHour(e.target.value)}
                    placeholder="2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`cron-minute-${config.id}`}>Минута (0-59)</Label>
                  <Input
                    id={`cron-minute-${config.id}`}
                    type="number"
                    min="0"
                    max="59"
                    value={cronMinute}
                    onChange={(e) => setCronMinute(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {config.job_id === 'daily_analytics_aggregation' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`cron-hour-${config.id}`}>Час (0-23)</Label>
              <Input
                id={`cron-hour-${config.id}`}
                type="number"
                min="0"
                max="23"
                value={cronHour}
                onChange={(e) => setCronHour(e.target.value)}
                placeholder="3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`cron-minute-${config.id}`}>Минута (0-59)</Label>
              <Input
                id={`cron-minute-${config.id}`}
                type="number"
                min="0"
                max="59"
                value={cronMinute}
                onChange={(e) => setCronMinute(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Сохранить настройки
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

