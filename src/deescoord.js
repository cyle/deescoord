import Discord from "discord.io";
import Lame from "lame";
import { usleep } from "sleep";
import stream from "stream";

global._deescoordListeners = {};

function isPromise(obj) {
  return !!obj && (typeof obj === "object" || typeof obj === "function") && typeof obj.then === "function";
}

export class Deescoord {
  constructor(token, MockClient) {
    this.token = token;

    this.client = MockClient || new Discord.Client({
      token,
      autorun: true,
    });

    this.client.on("ready", () => {
      console.log(`Logged in as ${this.client.username} - ${this.client.id}\n`);

      if (!this.prefix) {
        this.prefix = ".";
      }
    });
    this.client.on("message", this._parser());

    this.prefix = ".";
  }

  _isRegistered(message) {
    const [ prefix ] = message.split(" ");

    if (prefix.substring(this.prefix.length) in global._deescoordListeners) {
      return true;
    }

    return false;
  }

  _parser() {
    const self = this;

    return (user, userID, channelID, message, event) => {
      if (user === this.client.username || !message) { return; }

      if (message.startsWith(`@${self.client.username}`) ||
          message.startsWith(`<@${self.client.id}>`) ||
          message.startsWith(self.client.username)) {
        const [ , method, ...params ] = message.split(" ");

        if (method in global._deescoordListeners) {
          self._sendMessage(channelID, method, params, event.d);
        }
      } else if (
          message.startsWith(self.prefix) &&
          self._isRegistered(message)) {
        const [ prefix, ...params] = message.split(" ");
        const method = prefix.substring(self.prefix.length);

        self._sendMessage(channelID, method, params, event.d);
      }

      if ("*" in global._deescoordListeners) {
        self._sendMessage(channelID, "*", message, event.d);
      }
    };
  }

  _sendMessage(channelID, method, params, raw) {
    let response = this[global._deescoordListeners[method]](params, raw);

    if (response) {
      if (isPromise(response)) {
        response.then((data) => {
          this.client.sendMessage({
            to: channelID,
            message: data,
          });
        }, (err) => {
          this.client.sendMessage({
            to: channelID,
            message: `:warning: ${err}`,
          });
        });
      } else if (response instanceof stream.Readable) {
        let voiceChannelID = this._getVoiceChannel(raw.author.id);

        this.client.joinVoiceChannel(voiceChannelID, (err, events) => {
          usleep(100);

          this.client.getAudioContext(voiceChannelID, (err, stream) => {
            let lame = new Lame.Decoder();
            lame.once("readable", () => {
              stream.send(lame);
            });

            response.pipe(lame);
          });
        });
      } else {
        this.client.sendMessage({
          to: channelID,
          message: response,
        });
      }
    }

    return;
  }

  _getVoiceChannel(userID) {
    for (let server in this.client.servers) {
      for (let member in this.client.servers[server].members) {
        if (member === userID) {
          if (this.client.servers[server].members[member].voice_channel_id !== "undefined") {
            return this.client.servers[server].members[member].voice_channel_id;
          }
        }
      }
    }

    return null;
  }


}

export function command(target, key) {
  if (!key) {
    return (_target, _key) => {
      global._deescoordListeners[target] = _key;
    };
  } else {
    global._deescoordListeners[key] = key;
  }
}

String.prototype.startsWith = function(needle) { // eslint-disable-line no-extend-native
  return (this.indexOf(needle) === 0);
};
