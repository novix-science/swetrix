import { ChartOptions } from 'billboard.js'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { MainChart } from '../../View/components/MainChart'
import { getSettingsCaptcha } from '../../View/ViewProject.helpers'

interface CaptchaChartProps {
  chart?: {
    x: string[]
    results?: number[]
    generated?: number[]
    passed?: number[]
    failed?: number[]
    validationFailed?: number[]
    replayed?: number[]
  }
  timeBucket: string
  timeFormat: string
  rotateXAxis: boolean
  chartType: string
  dataNames: Record<string, string>
  className?: string
  children?: React.ReactNode
}

export const CaptchaChart = ({
  chart,
  timeBucket,
  timeFormat,
  rotateXAxis,
  chartType,
  dataNames,
  className,
  children,
}: CaptchaChartProps) => {
  const { i18n } = useTranslation('common')
  const language = i18n.resolvedLanguage || i18n.language
  const options: ChartOptions = useMemo(() => {
    if (!chart) {
      return {} as ChartOptions
    }
    return getSettingsCaptcha(
      chart,
      timeBucket,
      timeFormat,
      rotateXAxis,
      chartType,
      language,
    )
  }, [chart, timeBucket, timeFormat, rotateXAxis, chartType, language])

  const deps = useMemo(
    () => [
      chart,
      timeBucket,
      timeFormat,
      rotateXAxis,
      chartType,
      dataNames,
      language,
    ],
    [
      chart,
      timeBucket,
      timeFormat,
      rotateXAxis,
      chartType,
      dataNames,
      language,
    ],
  )

  if (!chart) {
    return null
  }

  return (
    <div className='overflow-hidden rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800/60 dark:bg-slate-900/25'>
      {children}
      <MainChart
        chartId='captcha-chart'
        options={options}
        dataNames={dataNames}
        className={className || 'mt-5 h-80 md:mt-0 [&_svg]:!overflow-visible'}
        deps={deps}
      />
    </div>
  )
}
