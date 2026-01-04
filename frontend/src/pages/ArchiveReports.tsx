import { useState, useEffect } from 'react'
import { Download, Trash2, RefreshCw, FileSpreadsheet, Calendar, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { reportsApi, ReportFile } from '@/lib/api'

export default function ArchiveReports() {
  const [reports, setReports] = useState<ReportFile[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadReports = async () => {
    try {
      setLoading(true)
      const data = await reportsApi.listReports('reports/', 100)
      setReports(data.files)
    } catch (error) {
      console.error('Failed to load reports:', error)
      alert('Ошибка при загрузке отчетов')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  const handleDownload = (report: ReportFile) => {
    const link = document.createElement('a')
    link.href = report.url
    link.download = report.filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDelete = async (report: ReportFile) => {
    if (!confirm(`Удалить отчет "${report.filename}"?`)) {
      return
    }

    try {
      setDeleting(report.name)
      await reportsApi.deleteReport(report.name)
      setReports(reports.filter(r => r.name !== report.name))
    } catch (error) {
      console.error('Failed to delete report:', error)
      alert('Ошибка при удалении отчета')
    } finally {
      setDeleting(null)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Неизвестно'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const getReportType = (filename: string): string => {
    if (filename.includes('product_')) return 'Отчет по товару'
    if (filename.includes('comparison_')) return 'Сравнение товаров'
    if (filename.includes('advanced_analytics')) return 'Расширенная аналитика'
    return 'Отчет'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Архив отчетов</h1>
          <p className="text-muted-foreground mt-2">
            Просмотр и управление сохраненными отчетами
          </p>
        </div>
        <Button onClick={loadReports} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Загрузка отчетов...</p>
        </Card>
      ) : reports.length === 0 ? (
        <Card className="p-8 text-center">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Нет сохраненных отчетов</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Всего отчетов: {reports.length}
          </div>
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card key={report.name} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold">{report.filename}</h3>
                        <p className="text-sm text-muted-foreground">
                          {getReportType(report.filename)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-2">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(report.last_modified)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <HardDrive className="h-4 w-4" />
                        <span>{formatFileSize(report.size)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => handleDownload(report)}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Скачать
                    </Button>
                    <Button
                      onClick={() => handleDelete(report)}
                      variant="outline"
                      size="sm"
                      disabled={deleting === report.name}
                    >
                      <Trash2 className={`h-4 w-4 mr-2 ${deleting === report.name ? 'animate-spin' : ''}`} />
                      Удалить
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

