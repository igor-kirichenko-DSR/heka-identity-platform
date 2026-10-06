/* eslint-disable @typescript-eslint/no-explicit-any */
import { Dispatch } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';

export interface ApiError extends Error {
  message: string;
  response: {
    status: number;
    statusText: string;
    data: {
      message?: string | string[];
    };
  };
}

export const errorMessage = (error: string | string[]) =>
  Array.isArray(error) ? error.join(', ') : error;

const UNKNOWN_SERVER_ERROR = 'Unknown server error';

/**
 * The server's message when it sent one; for a server response without one, a generic
 * message; otherwise (a client-side check such as "Schema is not registered", or a network
 * failure) the error's own message.
 */
const describeError = (error: unknown): string | string[] => {
  const response = (error as Partial<ApiError> | undefined)?.response;
  const serverMessage = response?.data?.message;
  if (serverMessage !== undefined) return serverMessage;
  if (response) return UNKNOWN_SERVER_ERROR;
  return error instanceof Error && error.message
    ? error.message
    : UNKNOWN_SERVER_ERROR;
};

/**
 * Shows the server's message and rejects the thunk with it. Session state is not touched
 * here: an expired session is renewed or dropped by the API layer, and the OIDC provider
 * mirrors the result into the user slice. The dispatch parameter is kept so existing
 * callers need no change.
 */
export const handleError = (
  error: Error,
  rejectWithValue: (message: string) => any,
  _dispatch?: Dispatch<any>,
) => {
  const message = errorMessage(describeError(error));
  if (message) toast.error(message);

  return rejectWithValue(message);
};
