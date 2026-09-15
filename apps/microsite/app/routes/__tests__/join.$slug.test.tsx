import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import JoinCampaign, { loader, meta, ErrorBoundary } from '../join.$slug'
import * as mockDataModule from '../../lib/mock-data'

vi.mock('../../lib/mock-data', async (importOriginal) => {
  const actual = await importOriginal<typeof mockDataModule>()
  return {
    ...actual,
    getMicrositeData: vi.fn(),
  }
})

describe('apps/microsite join.$slug.tsx', () => {
  const mockBackend = {} as Fetcher
  const mockContext = { cloudflare: { env: { BACKEND: mockBackend } } } as any

  const sampleMicrositeData: mockDataModule.MicrositeData = {
    microsite: {
      id: 'm1',
      business_id: 'b1',
      website_template_id: 't1',
      subdomain_slug: 'narvan',
      content: {
        logo_url: null,
        business_name: 'کافه نارون',
        tagline: 'طعم واقعی قهوه',
      },
      featured_campaign_id: 'c1',
      published: true,
      addon_status: 'active',
    },
    template: {
      id: 't1',
      name: 'Modern',
      theme_identifier: 'modern-dark',
    },
    modules: [
      {
        id: 'mod2',
        business_microsite_id: 'm1',
        website_module_id: 'w2',
        module_key: 'campaign_highlight',
        enabled: true,
        display_order: 1,
        content: {
          title: 'کمپین تابستانه',
          description: 'تخفیف ویژه مشتریان جدید',
          cta_label: 'عضویت در کمپین',
        },
      },
    ],
    featuredCampaign: {
      id: 'c1',
      public_join_slug: 'summer-discount',
      goal: 'acquisition',
    },
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('loader', () => {
    it('throws 404 Response when no business slug in host or search query', async () => {
      const request = new Request('https://localhost/join/summer-discount')
      await expect(
        loader({ request, params: { slug: 'summer-discount' }, context: mockContext } as any)
      ).rejects.toSatisfy((err: Response) => err instanceof Response && err.status === 404)
    })

    it('resolves business slug from ?business= query param', async () => {
      vi.mocked(mockDataModule.getMicrositeData).mockResolvedValueOnce(sampleMicrositeData)

      const request = new Request('https://localhost/join/summer-discount?business=narvan&ref=REF123')
      const result = await loader({
        request,
        params: { slug: 'summer-discount' },
        context: mockContext,
      } as any)

      expect(mockDataModule.getMicrositeData).toHaveBeenCalledWith('narvan', mockBackend)
      expect(result).toEqual({
        businessName: 'کافه نارون',
        theme: 'modern-dark',
        title: 'کمپین تابستانه',
        description: 'تخفیف ویژه مشتریان جدید',
        ctaLabel: 'عضویت در کمپین',
        joinSlug: 'summer-discount',
        refCode: 'REF123',
      })
    })

    it('resolves business slug from Host header', async () => {
      vi.mocked(mockDataModule.getMicrositeData).mockResolvedValueOnce(sampleMicrositeData)

      const request = new Request('https://narvan.domain.com/join/summer-discount', {
        headers: { host: 'narvan.domain.com' },
      })
      const result = await loader({
        request,
        params: { slug: 'summer-discount' },
        context: mockContext,
      } as any)

      expect(mockDataModule.getMicrositeData).toHaveBeenCalledWith('narvan', mockBackend)
      expect(result).toEqual({
        businessName: 'کافه نارون',
        theme: 'modern-dark',
        title: 'کمپین تابستانه',
        description: 'تخفیف ویژه مشتریان جدید',
        ctaLabel: 'عضویت در کمپین',
        joinSlug: 'summer-discount',
        refCode: null,
      })
    })

    it('throws 404 Response when getMicrositeData returns null', async () => {
      vi.mocked(mockDataModule.getMicrositeData).mockResolvedValueOnce(null)

      const request = new Request('https://localhost/join/summer-discount?business=unknown')
      await expect(
        loader({ request, params: { slug: 'summer-discount' }, context: mockContext } as any)
      ).rejects.toSatisfy((err: Response) => err instanceof Response && err.status === 404)
    })

    it('throws 404 Response when featuredCampaign is missing or slug does not match params.slug', async () => {
      const dataWithoutCampaign = { ...sampleMicrositeData, featuredCampaign: null }
      vi.mocked(mockDataModule.getMicrositeData).mockResolvedValueOnce(dataWithoutCampaign)

      const request1 = new Request('https://localhost/join/summer-discount?business=narvan')
      await expect(
        loader({ request: request1, params: { slug: 'summer-discount' }, context: mockContext } as any)
      ).rejects.toSatisfy((err: Response) => err instanceof Response && err.status === 404)

      vi.mocked(mockDataModule.getMicrositeData).mockResolvedValueOnce(sampleMicrositeData)
      const request2 = new Request('https://localhost/join/wrong-slug?business=narvan')
      await expect(
        loader({ request: request2, params: { slug: 'wrong-slug' }, context: mockContext } as any)
      ).rejects.toSatisfy((err: Response) => err instanceof Response && err.status === 404)
    })
  })

  describe('meta function', () => {
    it('returns default title when data is not provided', () => {
      const result = meta({ data: undefined } as any)
      expect(result).toEqual([{ title: 'کمپین پیدا نشد' }])
    })

    it('returns title with campaign title and business name when data is provided', () => {
      const result = meta({
        data: {
          title: 'کمپین تابستانه',
          businessName: 'کافه نارون',
        },
      } as any)
      expect(result).toEqual([{ title: 'کمپین تابستانه — کافه نارون' }])
    })
  })

  describe('rendering', () => {
    it('renders campaign details and join link to customer app with join & ref params', async () => {
      const loaderData = {
        businessName: 'کافه نارون',
        theme: 'modern-dark',
        title: 'کمپین تابستانه',
        description: 'تخفیف ویژه مشتریان جدید',
        ctaLabel: 'عضویت در کمپین',
        joinSlug: 'summer-discount',
        refCode: 'REF123',
      }

      const router = createMemoryRouter(
        [
          {
            path: '/join/:slug',
            element: <JoinCampaign />,
            loader: () => loaderData,
          },
        ],
        { initialEntries: ['/join/summer-discount'] }
      )

      render(<RouterProvider router={router} />)

      await waitFor(() => {
        expect(screen.getByText('کافه نارون')).toBeInTheDocument()
        expect(screen.getByText('کمپین تابستانه')).toBeInTheDocument()
        expect(screen.getByText('تخفیف ویژه مشتریان جدید')).toBeInTheDocument()

        const ctaBtn = screen.getByRole('link', { name: 'عضویت در کمپین' })
        expect(ctaBtn).toBeInTheDocument()
        expect(ctaBtn).toHaveAttribute(
          'href',
          'https://ai-campaign-builder-customer.pachoolai24.workers.dev/?join=summer-discount&ref=REF123'
        )
      })
    })

    it('renders ErrorBoundary (NotFound)', () => {
      render(<ErrorBoundary />)
      expect(screen.getByText('میکروسایت پیدا نشد')).toBeInTheDocument()
    })
  })
})
