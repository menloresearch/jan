import { ZodLiteral, ZodObject, ZodType, z } from 'zod'
import {
  CancelledNotificationSchema,
  ErrorCode,
  JSONRPCError,
  JSONRPCNotification,
  JSONRPCRequest,
  JSONRPCResponse,
  McpError,
  Notification,
  PingRequestSchema,
  Progress,
  ProgressNotification,
  ProgressNotificationSchema,
  Request,
  RequestId,
  Result,
} from '../types.js'
import { Transport } from './transport.js'

/**
 * Callback for progress notifications.
 */
export type ProgressCallback = (progress: Progress) => void

/**
 * Additional initialization options.
 */
export type ProtocolOptions = {
  /**
   * Whether to restrict emitted requests to only those that the remote side has indicated that they can handle, through their advertised capabilities.
   *
   * Note that this DOES NOT affect checking of _local_ side capabilities, as it is considered a logic error to mis-specify those.
   *
   * Currently this defaults to false, for backwards compatibility with SDK versions that did not advertise capabilities correctly. In future, this will default to true.
   */
  enforceStrictCapabilities?: boolean
}

/**
 * The default request timeout, in miliseconds.
 */
export const DEFAULT_REQUEST_TIMEOUT_MSEC = 60000

/**
 * Options that can be given per request.
 */
export type RequestOptions = {
  /**
   * If set, requests progress notifications from the remote end (if supported). When progress notifications are received, this callback will be invoked.
   */
  onprogress?: ProgressCallback

  /**
   * Can be used to cancel an in-flight request. This will cause an AbortError to be raised from request().
   */
  signal?: AbortSignal

  /**
   * A timeout (in milliseconds) for this request. If exceeded, an McpError with code `RequestTimeout` will be raised from request().
   *
   * If not specified, `DEFAULT_REQUEST_TIMEOUT_MSEC` will be used as the timeout.
   */
  timeout?: number
}

/**
 * Extra data given to request handlers.
 */
export type RequestHandlerExtra = {
  /**
   * An abort signal used to communicate if the request was cancelled from the sender's side.
   */
  signal: AbortSignal
}

/**
 * Implements MCP protocol framing on top of a pluggable transport, including
 * features like request/response linking, notifications, and progress.
 */
export abstract class Protocol<
  SendRequestT extends Request,
  SendNotificationT extends Notification,
  SendResultT extends Result,
> {
  private _transport?: Transport
  private _requestMessageId = 0
  private _requestHandlers: Map<
    string,
    (
      request: JSONRPCRequest,
      extra: RequestHandlerExtra
    ) => Promise<SendResultT>
  > = new Map()
  private _requestHandlerAbortControllers: Map<RequestId, AbortController> =
    new Map()
  private _notificationHandlers: Map<
    string,
    (notification: JSONRPCNotification) => Promise<void>
  > = new Map()
  private _responseHandlers: Map<
    number,
    (response: JSONRPCResponse | Error) => void
  > = new Map()
  private _progressHandlers: Map<number, ProgressCallback> = new Map()

  /**
   * Callback for when the connection is closed for any reason.
   *
   * This is invoked when close() is called as well.
   */
  onclose?: () => void

  /**
   * Callback for when an error occurs.
   *
   * Note that errors are not necessarily fatal; they are used for reporting any kind of exceptional condition out of band.
   */
  onerror?: (error: Error) => void

  /**
   * A handler to invoke for any request types that do not have their own handler installed.
   */
  fallbackRequestHandler?: (request: Request) => Promise<SendResultT>

  /**
   * A handler to invoke for any notification types that do not have their own handler installed.
   */
  fallbackNotificationHandler?: (notification: Notification) => Promise<void>

  constructor(private _options?: ProtocolOptions) {
    this.setNotificationHandler(CancelledNotificationSchema, (notification) => {
      const controller = this._requestHandlerAbortControllers.get(
        notification.params.requestId
      )
      controller?.abort(notification.params.reason)
    })

    this.setNotificationHandler(ProgressNotificationSchema, (notification) => {
      this._onprogress(notification as unknown as ProgressNotification)
    })

    this.setRequestHandler(
      PingRequestSchema,
      // Automatic pong by default.
      (_request) => ({}) as SendResultT
    )
  }

  /**
   * Attaches to the given transport, starts it, and starts listening for messages.
   *
   * The Protocol object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
   */
  async connect(transport: Transport): Promise<void> {
    this._transport = transport
    this._transport.onclose = () => {
      this._onclose()
    }

    this._transport.onerror = (error: Error) => {
      this._onerror(error)
    }

    this._transport.onmessage = (message) => {
      if (!('method' in message)) {
        this._onresponse(message)
      } else if ('id' in message) {
        this._onrequest(message)
      } else {
        this._onnotification(message)
      }
    }

    await this._transport.start()
  }

  private _onclose(): void {
    const responseHandlers = this._responseHandlers
    this._responseHandlers = new Map()
    this._progressHandlers.clear()
    this._transport = undefined
    this.onclose?.()

    const error = new McpError(ErrorCode.ConnectionClosed, 'Connection closed')
    for (const handler of responseHandlers.values()) {
      handler(error)
    }
  }

  private _onerror(error: Error): void {
    this.onerror?.(error)
  }

  private _onnotification(notification: JSONRPCNotification): void {
    const handler =
      this._notificationHandlers.get(notification.method) ??
      this.fallbackNotificationHandler

    // Ignore notifications not being subscribed to.
    if (handler === undefined) {
      return
    }

    // Starting with Promise.resolve() puts any synchronous errors into the monad as well.
    Promise.resolve()
      .then(() => handler(notification))
      .catch((error) =>
        this._onerror(
          new Error(`Uncaught error in notification handler: ${error}`)
        )
      )
  }

  private _onrequest(request: JSONRPCRequest): void {
    const handler =
      this._requestHandlers.get(request.method) ?? this.fallbackRequestHandler

    if (handler === undefined) {
      this._transport
        ?.send({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: ErrorCode.MethodNotFound,
            message: 'Method not found',
          },
        })
        .catch((error) =>
          this._onerror(new Error(`Failed to send an error response: ${error}`))
        )
      return
    }

    const abortController = new AbortController()
    this._requestHandlerAbortControllers.set(request.id, abortController)

    // Starting with Promise.resolve() puts any synchronous errors into the monad as well.
    Promise.resolve()
      .then(() => handler(request, { signal: abortController.signal }))
      .then(
        (result) => {
          if (abortController.signal.aborted) {
            return
          }

          return this._transport?.send({
            result,
            jsonrpc: '2.0',
            id: request.id,
          })
        },
        (error) => {
          if (abortController.signal.aborted) {
            return
          }

          return this._transport?.send({
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: Number.isSafeInteger(error['code'])
                ? error['code']
                : ErrorCode.InternalError,
              message: error.message ?? 'Internal error',
            },
          })
        }
      )
      .catch((error) =>
        this._onerror(new Error(`Failed to send response: ${error}`))
      )
      .finally(() => {
        this._requestHandlerAbortControllers.delete(request.id)
      })
  }

  private _onprogress(notification: ProgressNotification): void {
    const { progressToken, ...params } = notification.params
    const handler = this._progressHandlers.get(Number(progressToken))
    if (handler === undefined) {
      this._onerror(
        new Error(
          `Received a progress notification for an unknown token: ${JSON.stringify(notification)}`
        )
      )
      return
    }

    handler(params)
  }

  private _onresponse(response: JSONRPCResponse | JSONRPCError): void {
    const messageId = response.id
    const handler = this._responseHandlers.get(Number(messageId))
    if (handler === undefined) {
      this._onerror(
        new Error(
          `Received a response for an unknown message ID: ${JSON.stringify(response)}`
        )
      )
      return
    }

    this._responseHandlers.delete(Number(messageId))
    this._progressHandlers.delete(Number(messageId))
    if ('result' in response) {
      handler(response)
    } else {
      const error = new McpError(
        response.error.code,
        response.error.message,
        response.error.data
      )
      handler(error)
    }
  }

  get transport(): Transport | undefined {
    return this._transport
  }

  /**
   * Closes the connection.
   */
  async close(): Promise<void> {
    await this._transport?.close()
  }

  /**
   * A method to check if a capability is supported by the remote side, for the given method to be called.
   *
   * This should be implemented by subclasses.
   */
  protected abstract assertCapabilityForMethod(
    method: SendRequestT['method']
  ): void

  /**
   * A method to check if a notification is supported by the local side, for the given method to be sent.
   *
   * This should be implemented by subclasses.
   */
  protected abstract assertNotificationCapability(
    method: SendNotificationT['method']
  ): void

  /**
   * A method to check if a request handler is supported by the local side, for the given method to be handled.
   *
   * This should be implemented by subclasses.
   */
  protected abstract assertRequestHandlerCapability(method: string): void

  /**
   * Sends a request and wait for a response.
   *
   * Do not use this method to emit notifications! Use notification() instead.
   */
  request<T extends ZodType<object>>(
    request: SendRequestT,
    resultSchema: T,
    options?: RequestOptions
  ): Promise<z.infer<T>> {
    return new Promise((resolve, reject) => {
      if (!this._transport) {
        reject(new Error('Not connected'))
        return
      }

      if (this._options?.enforceStrictCapabilities === true) {
        this.assertCapabilityForMethod(request.method)
      }

      options?.signal?.throwIfAborted()

      const messageId = this._requestMessageId++
      const jsonrpcRequest: JSONRPCRequest = {
        ...request,
        jsonrpc: '2.0',
        id: messageId,
      }

      if (options?.onprogress) {
        this._progressHandlers.set(messageId, options.onprogress)
        jsonrpcRequest.params = {
          ...request.params,
          _meta: { progressToken: messageId },
        }
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined

      this._responseHandlers.set(messageId, (response) => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
        }

        if (options?.signal?.aborted) {
          return
        }

        if (response instanceof Error) {
          return reject(response)
        }

        try {
          const result = resultSchema.parse(response.result)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      const cancel = (reason: unknown) => {
        this._responseHandlers.delete(messageId)
        this._progressHandlers.delete(messageId)

        this._transport
          ?.send({
            jsonrpc: '2.0',
            method: 'notifications/cancelled',
            params: {
              requestId: messageId,
              reason: String(reason),
            },
          })
          .catch((error) =>
            this._onerror(new Error(`Failed to send cancellation: ${error}`))
          )

        reject(reason)
      }

      options?.signal?.addEventListener('abort', () => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
        }

        cancel(options?.signal?.reason)
      })

      const timeout = options?.timeout ?? DEFAULT_REQUEST_TIMEOUT_MSEC
      timeoutId = setTimeout(
        () =>
          cancel(
            new McpError(ErrorCode.RequestTimeout, 'Request timed out', {
              timeout,
            })
          ),
        timeout
      )

      this._transport.send(jsonrpcRequest).catch((error) => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
        }

        reject(error)
      })
    })
  }

  /**
   * Emits a notification, which is a one-way message that does not expect a response.
   */
  async notification(notification: SendNotificationT): Promise<void> {
    if (!this._transport) {
      throw new Error('Not connected')
    }

    this.assertNotificationCapability(notification.method)

    const jsonrpcNotification: JSONRPCNotification = {
      ...notification,
      jsonrpc: '2.0',
    }

    await this._transport.send(jsonrpcNotification)
  }

  /**
   * Registers a handler to invoke when this protocol object receives a request with the given method.
   *
   * Note that this will replace any previous request handler for the same method.
   */
  setRequestHandler<
    T extends ZodObject<{
      method: ZodLiteral<string>
    }>,
  >(
    requestSchema: T,
    handler: (
      request: z.infer<T>,
      extra: RequestHandlerExtra
    ) => SendResultT | Promise<SendResultT>
  ): void {
    const method = requestSchema.shape.method.value
    this.assertRequestHandlerCapability(method)
    this._requestHandlers.set(method, (request, extra) =>
      Promise.resolve(handler(requestSchema.parse(request), extra))
    )
  }

  /**
   * Removes the request handler for the given method.
   */
  removeRequestHandler(method: string): void {
    this._requestHandlers.delete(method)
  }

  /**
   * Registers a handler to invoke when this protocol object receives a notification with the given method.
   *
   * Note that this will replace any previous notification handler for the same method.
   */
  setNotificationHandler<
    T extends ZodObject<{
      method: ZodLiteral<string>
    }>,
  >(
    notificationSchema: T,
    handler: (notification: z.infer<T>) => void | Promise<void>
  ): void {
    this._notificationHandlers.set(
      notificationSchema.shape.method.value,
      (notification) =>
        Promise.resolve(handler(notificationSchema.parse(notification)))
    )
  }

  /**
   * Removes the notification handler for the given method.
   */
  removeNotificationHandler(method: string): void {
    this._notificationHandlers.delete(method)
  }
}
