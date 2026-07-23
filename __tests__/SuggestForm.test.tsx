/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SuggestForm } from '@/components/SuggestForm'

describe('SuggestForm', () => {
  afterEach(() => jest.restoreAllMocks())

  it('submits and shows success with an issue link', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        url: 'https://github.com/liampeng1/whats-building-sf/issues/1',
      }),
    }) as unknown as typeof fetch

    render(<SuggestForm />)
    fireEvent.change(screen.getByLabelText(/your suggestion/i), {
      target: { value: 'add dark mode' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send suggestion/i }))

    await waitFor(() =>
      expect(screen.getByText(/suggestion filed/i)).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /view it on github/i })).toHaveAttribute(
      'href',
      'https://github.com/liampeng1/whats-building-sf/issues/1',
    )
  })

  it('shows an error when the request fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }) as unknown as typeof fetch

    render(<SuggestForm />)
    fireEvent.change(screen.getByLabelText(/your suggestion/i), {
      target: { value: 'x' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send suggestion/i }))

    await waitFor(() => expect(screen.getByText(/couldn.t send/i)).toBeInTheDocument())
  })
})
