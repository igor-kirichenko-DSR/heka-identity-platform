import { PayloadAction } from '@reduxjs/toolkit';

import {
  updatePresentationState,
  CheckPresentationStateResult,
} from '@/entities/Presentation/model/services/updatePresentationState';
import { buildSlice } from '@/shared/lib/store';

import {
  requestPresentation,
  RequestPresentationResult,
} from '../services/requestPresentation';
import { PresentationSchema } from '../types/presentation';

const initialState: PresentationSchema = {
  isLoading: false,
  error: undefined,
  presentationSession: undefined,
};

export const presentationSlice = buildSlice({
  name: 'presentations',
  initialState,
  reducers: {
    reset: (state) => {
      state.isLoading = initialState.isLoading;
      state.error = initialState.error;
      state.presentationSession = initialState.presentationSession;
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(requestPresentation.pending, (state) => {
        state.isLoading = true;
        state.error = undefined;
        state.presentationSession = undefined;
      })
      .addCase(
        requestPresentation.fulfilled,
        (state, action: PayloadAction<RequestPresentationResult>) => {
          state.isLoading = false;
          state.error = undefined;
          state.presentationSession = action.payload;
        },
      )
      .addCase(requestPresentation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? action.error.message;
        state.presentationSession = undefined;
      })
      .addCase(updatePresentationState.fulfilled, (state, action) => {
        const session = state.presentationSession;
        // Ignore answers for a request that has since been replaced
        if (!session || session.id !== action.meta.arg.id) return;
        const result: CheckPresentationStateResult = action.payload;
        session.state = result.state;
        session.sharedAttributes = result.sharedAttributes;
      }),
});

export const {
  reducer: presentationReducer,
  actions: presentationActions,
  useActions: usePresentationActions,
} = presentationSlice;
