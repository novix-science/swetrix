import { PlusIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import Button from '~/ui/Button'
import { Link } from '~/ui/Link'
import { Text } from '~/ui/Text'
import routes from '~/utils/routes'

interface FunnelEmptyStateActionProps {
  isAuthenticated: boolean
  allowedToManage: boolean
  selfHosted: boolean
  onCreate: () => void
}

export default function FunnelEmptyStateAction({
  isAuthenticated,
  allowedToManage,
  selfHosted,
  onCreate,
}: FunnelEmptyStateActionProps) {
  const { t } = useTranslation('common')
  if (isAuthenticated) {
    return allowedToManage ? (
      <Button size='lg' onClick={onCreate}>
        <PlusIcon className='mr-1.5 size-4' />
        {t('dashboard.newFunnel')}
      </Button>
    ) : (
      <Text as='p' size='sm' colour='secondary' className='mx-auto max-w-md'>
        {t('dashboard.funnelsReadOnly')}
      </Text>
    )
  }
  return (
    <Link
      to={selfHosted ? routes.signin : routes.signup}
      aria-label={t(selfHosted ? 'titles.signin' : 'titles.signup')}
      className='inline-flex items-center justify-center rounded-md border border-transparent bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
    >
      {t(selfHosted ? 'titles.signin' : 'header.startForFree')}
    </Link>
  )
}
