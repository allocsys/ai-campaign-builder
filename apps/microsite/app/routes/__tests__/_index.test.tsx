import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import MicrositeIndex, { loader, meta, ErrorBoundary } from '../_index'
import * as mockDataModule from '../../lib/mock-data'

vi.mock('../../lib/mock-data', async (importOriginal) => {
  const actual = await importOriginal<typeof mockDataModule>()
  return {
    ...actual,
    getMicrositeData: vi.fn(),
  }
})

describe('apps/microsite _index.tsx', () => {
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
        id: 'mod1',
        business_microsite_id: 'm1',
        website_module_id: 'w1',
        module_key: 'hero',
        enabled: true,
        display_order: 1,
        content: {
          badge_label: 'خوش آمدید',
          title: 'کافه نارون',
          subtitle: 'بهترین کیفیت قهوه',
        },
      },
      {
        id: 'mod2',
        business_microsite_id: 'm1',
        website_module_id: 'w2',
        module_key: 'campaign_highlight',
        enabled: true,
        display_order: 2,
        content: {
          title: 'کمپین قهوه رایگان',
          description: 'با ثبت نام یک قهوه رایگان دریافت کنید',
          cta_label: 'دریافت تخفیف',
        },
      },
      {
        id: 'mod3',
        business_microsite_id: 'm1',
        website_module_id: 'w3',
        module_key: 'about',
        enabled: true,
        display_order: 3,
        content: {
          heading: 'درباره ما',
          description: 'تاریخچه کافه نارون',
        },
      },
      {
        id: 'mod4',
        business_microsite_id: 'm1',
        website_module_id: 'w4',
        module_key: 'product_menu',
        enabled: true,
        display_order: 4,
        content: {
          heading: 'منوی محصولات',
          items: [{ name: 'اسپرسو', price_toman: 50000 }],
        },
      },
      {
        id: 'mod5',
        business_microsite_id: 'm1',
        website_module_id: 'w5',
        module_key: 'gallery',
        enabled: true,
        display_order: 5,
        content: {
          heading: 'گالری تصاویر',
          images: [{ alt: 'تصویر ۱' }],
        },
      },
      {
        id: 'mod6',
        business_microsite_id: 'm1',
        website_module_id: 'w6',
        module_key: 'contact',
        enabled: true,
        display_order: 6,
        content: {
          address: 'تهران، خیابان ولیعصر',
          phone: '02112345678',
          hours: '۸ صبح تا ۱۰ شب',
        },
      },
      {
        id: 'mod7',
        business_microsite_id: 'm1',
        website_module_id: 'w7',
        module_key: 'testimonials',
        enabled: true,
        display_order: 7,
        content: {
          heading: 'نظرات مشتریان',
          items: [{ quote: 'عالی بود', author: 'علی' }],
        },
      },
      {
        id: 'mod8',
        business_microsite_id: 'm1',
        website_module_id: 'w8',
        module_key: 'booking_cta',
        enabled: true,
        display_order: 8,
        content: {
          heading: 'رزرو میز',
          button_label: 'رزرو کنید',
        },
      },
    ],
    featuredCampaign: {
      id: 'c1',
      public_join_slug: 'free-coffee',
      goal: 'acquisition',
    },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  describe('loader', () => {
    it('returns kind: landing when no subdomain host and no slug query param', async () => {
      const request = new Request('https://localhost/')
      const result = await loader({ request, params: {}, context: mockContext } as any)
      expect(result).toEqual({ kind: 'landing' })
      expect(mockDataModule.getMicrositeData).not.toHaveBeenCalled()
    })

    it('resolves slug from search param ?slug=narvan and calls getMicrositeData', async () => {
      vi.mocked(mockDataModule.getMicrositeData).mockResolvedValueOnce(sampleMicrositeData)

      const request = new Request('https://localhost/?slug=narvan')
      const result = await loader({ request, params: {}, context: mockContext } as any)

      expect(mockDataModule.getMicrositeData).toHaveBeenCalledWith('narvan', mockBackend)
      expect(result).toEqual({
        kind: 'microsite',
        businessSlug: 'narvan',
        ...sampleMicrositeData,
      })
    })

    it('resolves slug from Host header (e.g. narvan.domain.com)', async () => {
      vi.mocked(mockDataModule.getMicrositeData).mockResolvedValueOnce(sampleMicrositeData)

      const request = new Request('https://narvan.domain.com/', {
        headers: { host: 'narvan.domain.com' },
      })
      const result = await loader({ request, params: {}, context: mockContext } as any)

      expect(mockDataModule.getMicrositeData).toHaveBeenCalledWith('narvan', mockBackend)
      expect(result).toEqual({
        kind: 'microsite',
        businessSlug: 'narvan',
        ...sampleMicrositeData,
      })
    })

    it('throws a 404 Response when getMicrositeData returns null', async () => {
      vi.mocked(mockDataModule.getMicrositeData).mockResolvedValueOnce(null)

      const request = new Request('https://localhost/?slug=unknown')

      await expect(loader({ request, params: {}, context: mockContext } as any)).rejects.toSatisfy(
        (err: Response) => {
          return err instanceof Response && err.status === 404
        }
      )
    })
  })

  describe('meta function', () => {
    it('returns default landing title when data is missing or kind is landing', () => {
      const metaLanding = meta({ data: { kind: 'landing' } } as any)
      expect(metaLanding).toEqual([{ title: 'ai-campaign-builder — میکروسایت‌ها' }])

      const metaNull = meta({ data: undefined } as any)
      expect(metaNull).toEqual([{ title: 'ai-campaign-builder — میکروسایت‌ها' }])
    })

    it('returns business name and tagline title when kind is microsite', () => {
      const metaMicrosite = meta({
        data: {
          kind: 'microsite',
          businessSlug: 'narvan',
          ...sampleMicrositeData,
        },
      } as any)
      expect(metaMicrosite).toEqual([{ title: 'کافه نارون — طعم واقعی قهوه' }])
    })
  })

  describe('rendering', () => {
    it('renders Landing component when data.kind is landing', async () => {
      const router = createMemoryRouter(
        [
          {
            path: '/',
            element: <MicrositeIndex />,
            loader: () => ({ kind: 'landing' as const }),
          },
        ],
        { initialEntries: ['/'] }
      )

      render(<RouterProvider router={router} />)

      await waitFor(() => {
        expect(screen.getByText('میکروسایت هر کسب‌وکار، روی زیردامنه خودش')).toBeInTheDocument()
      })
    })

    it('renders full microsite with all modules and StickyJoinCta when kind is microsite', async () => {
      const loaderData = {
        kind: 'microsite' as const,
        businessSlug: 'narvan',
        ...sampleMicrositeData,
      }

      const router = createMemoryRouter(
        [
          {
            path: '/',
            element: <MicrositeIndex />,
            loader: () => loaderData,
          },
        ],
        { initialEntries: ['/'] }
      )

      render(<RouterProvider router={router} />)

      await waitFor(() => {
        // Hero
        expect(screen.getByText('خوش آمدید')).toBeInTheDocument()
        // CampaignHighlight
        expect(screen.getByText('کمپین قهوه رایگان')).toBeInTheDocument()
        // About
        expect(screen.getByText('درباره ما')).toBeInTheDocument()
        // ProductMenu
        expect(screen.getByText('منوی محصولات')).toBeInTheDocument()
        // Gallery
        expect(screen.getByText('گالری تصاویر')).toBeInTheDocument()
        // Contact
        expect(screen.getByText('تهران، خیابان ولیعصر')).toBeInTheDocument()
        // Testimonials
        expect(screen.getByText('نظرات مشتریان')).toBeInTheDocument()
        // BookingCta
        expect(screen.getByText('رزرو میز')).toBeInTheDocument()

        // Footer
        expect(screen.getByText('© کافه نارون')).toBeInTheDocument()

        // StickyJoinCta link with campaign public_join_slug and ?business= query param
        const joinLinks = screen.getAllByRole('link', { name: 'دریافت تخفیف' })
        expect(joinLinks.length).toBeGreaterThanOrEqual(1)
        expect(joinLinks[0]).toHaveAttribute('href', '/join/free-coffee?business=narvan')
      })
    })

    it('renders ErrorBoundary (NotFound)', () => {
      render(<ErrorBoundary />)
      expect(screen.getByText('میکروسایت پیدا نشد')).toBeInTheDocument()
    })
  })
})
