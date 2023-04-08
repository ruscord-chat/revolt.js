import type {
  Channel as ApiChannel,
  Member as ApiMember,
  Message as ApiMessage,
  User as ApiUser,
  DataEditChannel,
  DataMessageSend,
  OptionsMessageSearch,
  Override,
} from "revolt-api";
import { APIRoutes } from "revolt-api/dist/routes";
import { decodeTime, ulid } from "ulid";

import { Message } from "..";
import { ChannelCollection } from "../collections";
import { bitwiseAndEq, calculatePermission } from "../permissions/calculator";
import { Permission } from "../permissions/definitions";

/**
 * Channel Class
 */
export class Channel {
  readonly collection: ChannelCollection;
  readonly id: string;

  /**
   * Construct Channel
   * @param collection Collection
   * @param id Channel Id
   */
  constructor(collection: ChannelCollection, id: string, data?: ApiChannel) {
    this.collection = collection;
    this.id = id;
  }

  /**
   * Time when this server was created
   */
  get createdAt() {
    return new Date(decodeTime(this.id));
  }

  /**
   * Channel type
   */
  get type() {
    return this.collection.getUnderlyingObject(this.id).channelType;
  }

  /**
   * Absolute pathname to this channel in the client
   */
  get path() {
    if (this.serverId) {
      return `/server/${this.serverId}/channel/${this.id}`;
    } else {
      return `/channel/${this.id}`;
    }
  }

  /**
   * URL to this channel
   */
  get url() {
    return this.collection.client.configuration?.app + this.path;
  }

  /**
   * Channel name
   */
  get name() {
    return this.collection.getUnderlyingObject(this.id).name;
  }

  /**
   * Channel description
   */
  get description() {
    return this.collection.getUnderlyingObject(this.id).description;
  }

  /**
   * Channel icon
   */
  get icon() {
    return this.collection.getUnderlyingObject(this.id).icon;
  }

  /**
   * Whether the conversation is active
   */
  get active() {
    return this.collection.getUnderlyingObject(this.id).active;
  }

  /**
   * User ids of people currently typing in channel
   */
  get typingIds() {
    return this.collection.getUnderlyingObject(this.id).recipientIds;
  }

  /**
   * Users currently trying in channel
   */
  get typing() {
    return [
      ...this.collection.getUnderlyingObject(this.id).typingIds.values(),
    ].map((id) => this.collection.client.users.get(id)!);
  }

  /**
   * User ids of recipients of the group
   */
  get recipientIds() {
    return this.collection.getUnderlyingObject(this.id).recipientIds;
  }

  /**
   * Recipients of the group
   */
  get recipients() {
    return [
      ...this.collection.getUnderlyingObject(this.id).recipientIds.values(),
    ].map((id) => this.collection.client.users.get(id)!);
  }

  /**
   * Find recipient of this DM
   */
  get recipient() {
    return this.type === "DirectMessage"
      ? this.recipients.find(
          (user) => user.id !== this.collection.client.user!.id
        )
      : undefined;
  }

  /**
   * User ID
   */
  get userId() {
    return this.collection.getUnderlyingObject(this.id).userId!;
  }

  /**
   * User this channel belongs to
   */
  get user() {
    return this.collection.client.users.get(
      this.collection.getUnderlyingObject(this.id).userId!
    );
  }

  /**
   * Owner ID
   */
  get ownerId() {
    return this.collection.getUnderlyingObject(this.id).ownerId!;
  }

  /**
   * Owner of the group
   */
  get owner() {
    return this.collection.client.users.get(
      this.collection.getUnderlyingObject(this.id).ownerId!
    );
  }

  /**
   * Server ID
   */
  get serverId() {
    return this.collection.getUnderlyingObject(this.id).serverId!;
  }

  /**
   * Server this channel is in
   */
  get server() {
    return this.collection.client.servers.get(
      this.collection.getUnderlyingObject(this.id).serverId!
    );
  }

  /**
   * Permissions allowed for users in this group
   */
  get permissions() {
    return this.collection.getUnderlyingObject(this.id).permissions;
  }

  /**
   * Default permissions for this server channel
   */
  get defaultPermissions() {
    return this.collection.getUnderlyingObject(this.id).defaultPermissions;
  }

  /**
   * Role permissions for this server channel
   */
  get rolePermissions() {
    return this.collection.getUnderlyingObject(this.id).rolePermissions;
  }

  /**
   * Whether this channel is marked as mature
   */
  get mature() {
    return this.collection.getUnderlyingObject(this.id).nsfw;
  }

  /**
   * ID of the last message sent in this channel
   */
  get lastMessageId() {
    return this.collection.getUnderlyingObject(this.id).lastMessageId;
  }

  /**
   * Time when the last message was sent
   */
  get lastMessageAt() {
    return this.lastMessageId
      ? new Date(decodeTime(this.lastMessageId))
      : undefined;
  }

  /**
   * Time when the channel was last updated (either created or a message was sent)
   */
  get updatedAt() {
    return this.lastMessageAt ?? this.createdAt;
  }

  // TODO: lastMessage

  get unread() {
    return false;
  }

  get mentions() {
    return [];
  }

  /**
   * URL to the channel icon
   */
  get iconURL() {
    return this.collection.client.createFileURL(
      this.icon ?? this.recipient?.avatar,
      {
        max_side: 256,
      }
    );
  }

  /**
   * URL to a small variant of the channel icon
   */
  get smallIconURL() {
    return this.collection.client.createFileURL(
      this.icon ?? this.recipient?.avatar,
      {
        max_side: 64,
      }
    );
  }

  /**
   * URL to the animated channel icon
   */
  get animatedIconURL() {
    return this.collection.client.createFileURL(
      this.icon ?? this.recipient?.avatar,
      { max_side: 256 },
      true
    );
  }

  /**
   * Permission the currently authenticated user has against this channel
   */
  get permission() {
    return calculatePermission(this.collection.client, this);
  }

  /**
   * Check whether we have a given permission in a channel
   * @param permission Permission Names
   * @returns Whether we have this permission
   */
  havePermission(...permission: (keyof typeof Permission)[]) {
    return bitwiseAndEq(
      this.permission,
      ...permission.map((x) => Permission[x])
    );
  }

  /**
   * Fetch a channel's members.
   * @requires `Group`
   * @returns An array of the channel's members.
   */
  async fetchMembers() {
    const members = await this.collection.client.api.get(
      `/channels/${this.id as ""}/members`
    );

    return members.map((user) =>
      this.collection.client.users.getOrCreate(user._id, user)
    );
  }

  /**
   * Edit a channel
   * @param data Edit data
   */
  async edit(data: DataEditChannel) {
    await this.collection.client.api.patch(`/channels/${this.id as ""}`, data);
  }

  /**
   * Delete a channel
   * @param leave_silently Whether to not send a message on leave
   * @param noRequest Whether to not send a request
   * @requires `DM`, `Group`, `TextChannel`, `VoiceChannel`
   */
  async delete(leave_silently?: boolean, noRequest?: boolean) {
    if (!noRequest)
      await this.collection.client.api.delete(`/channels/${this.id as ""}`, {
        leave_silently,
      });

    if (this.type === "DirectMessage") {
      this.collection.updateUnderlyingObject(this.id, "active", false);
      return;
    }

    this.collection.client.channels.delete(this.id);
  }

  /**
   * Add a user to a group
   * @param user_id ID of the target user
   */
  async addMember(user_id: string) {
    return await this.collection.client.api.put(
      `/channels/${this.id as ""}/recipients/${user_id as ""}`
    );
  }

  /**
   * Remove a user from a group
   * @param user_id ID of the target user
   */
  async removeMember(user_id: string) {
    return await this.collection.client.api.delete(
      `/channels/${this.id as ""}/recipients/${user_id as ""}`
    );
  }
  /**
   * Send a message
   * @param data Either the message as a string or message sending route data
   * @returns The message
   */
  async sendMessage(
    data: string | DataMessageSend,
    idempotencyKey: string = ulid()
  ) {
    const msg: DataMessageSend =
      typeof data === "string" ? { content: data } : data;

    const message = await this.collection.client.api.post(
      `/channels/${this.id as ""}/messages`,
      msg,
      {
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      }
    );

    return this.collection.client.messages.getOrCreate(
      message._id,
      message,
      true
    );
  }

  /**
   * Fetch a message by its ID
   * @param messageId ID of the target message
   * @returns The message
   */
  async fetchMessage(messageId: string) {
    const message = await this.collection.client.api.get(
      `/channels/${this.id as ""}/messages/${messageId as ""}`
    );

    return this.collection.client.messages.getOrCreate(message._id, message);
  }

  /**
   * Fetch multiple messages from a channel
   * @param params Message fetching route data
   * @returns The messages
   */
  async fetchMessages(
    params?: Omit<
      (APIRoutes & {
        method: "get";
        path: "/channels/{target}/messages";
      })["params"],
      "include_users"
    >
  ) {
    const messages = (await this.collection.client.api.get(
      `/channels/${this.id as ""}/messages`,
      { ...params }
    )) as ApiMessage[];

    return messages.map((message) =>
      this.collection.client.messages.getOrCreate(message._id, message)
    );
  }

  /**
   * Fetch multiple messages from a channel including the users that sent them
   * @param params Message fetching route data
   * @returns Object including messages and users
   */
  async fetchMessagesWithUsers(
    params?: Omit<
      (APIRoutes & {
        method: "get";
        path: "/channels/{target}/messages";
      })["params"],
      "include_users"
    >
  ) {
    const data = (await this.collection.client.api.get(
      `/channels/${this.id as ""}/messages`,
      { ...params, include_users: true }
    )) as { messages: ApiMessage[]; users: ApiUser[]; members?: ApiMember[] };

    return {
      messages: data.messages.map((message) =>
        this.collection.client.messages.getOrCreate(message._id, message)
      ),
      users: data.users.map((user) =>
        this.collection.client.users.getOrCreate(user._id, user)
      ),
      members: data.members?.map((member) =>
        this.collection.client.serverMembers.getOrCreate(member._id, member)
      ),
    };
  }

  /**
   * Search for messages
   * @param params Message searching route data
   * @returns The messages
   */
  async search(params: Omit<OptionsMessageSearch, "include_users">) {
    const messages = (await this.collection.client.api.post(
      `/channels/${this.id as ""}/search`,
      params
    )) as ApiMessage[];

    return messages.map((message) =>
      this.collection.client.messages.getOrCreate(message._id, message)
    );
  }

  /**
   * Search for messages including the users that sent them
   * @param params Message searching route data
   * @returns The messages
   */
  async searchWithUsers(params: Omit<OptionsMessageSearch, "include_users">) {
    const data = (await this.collection.client.api.post(
      `/channels/${this.id as ""}/search`,
      {
        ...params,
        include_users: true,
      }
    )) as { messages: ApiMessage[]; users: ApiUser[]; members?: ApiMember[] };

    return {
      messages: data.messages.map((message) =>
        this.collection.client.messages.getOrCreate(message._id, message)
      ),
      users: data.users.map((user) =>
        this.collection.client.users.getOrCreate(user._id, user)
      ),
      members: data.members?.map((member) =>
        this.collection.client.serverMembers.getOrCreate(member._id, member)
      ),
    };
  }

  async deleteMessages(ids: string[]) {
    await this.collection.client.api.delete(
      `/channels/${this.id as ""}/messages/bulk`,
      {
        data: { ids },
      }
    );
  }

  /**
   * Create an invite to the channel
   * @returns Newly created invite code
   */
  async createInvite() {
    return await this.collection.client.api.post(
      `/channels/${this.id as ""}/invites`
    );
  }

  #ackTimeout?: number;
  #ackLimit?: number;

  /**
   * Mark a channel as read
   * @param message Last read message or its ID
   * @param skipRateLimiter Whether to skip the internal rate limiter
   */
  async ack(message?: Message | string, skipRateLimiter?: boolean) {
    const id =
      (typeof message === "string" ? message : message?.id) ??
      this.lastMessageId ??
      ulid();

    const performAck = () => {
      this.#ackLimit = undefined;
      this.collection.client.api.put(`/channels/${this.id}/ack/${id as ""}`);
    };

    // TODO: !this.collection.client.options.ackRateLimiter
    if (skipRateLimiter) return performAck();

    clearTimeout(this.#ackTimeout);
    if (this.#ackLimit && +new Date() > this.#ackLimit) {
      performAck();
    }

    // We need to use setTimeout here for both Node.js and browser.
    this.#ackTimeout = setTimeout(performAck, 5000) as unknown as number;

    if (!this.#ackLimit) {
      this.#ackLimit = +new Date() + 15e3;
    }
  }

  /**
   * Set role permissions
   * @param role_id Role Id, set to 'default' to affect all users
   * @param permissions Permission value
   */
  async setPermissions(role_id = "default", permissions: Override) {
    return await this.collection.client.api.put(
      `/channels/${this.id as ""}/permissions/${role_id as ""}`,
      { permissions }
    );
  }

  /**
   * Start typing in this channel
   */
  startTyping() {
    this.collection.client.events.send({
      type: "BeginTyping",
      channel: this.id,
    });
  }

  /**
   * Stop typing in this channel
   */
  stopTyping() {
    this.collection.client.events.send({ type: "EndTyping", channel: this.id });
  }
}
