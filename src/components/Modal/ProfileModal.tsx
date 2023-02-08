import React from 'react';
import { Modal, Button, Icon, Image, Popup } from 'semantic-ui-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { serverPath } from '../../utils';
import axios from 'axios';

export class ProfileModal extends React.Component<{
  close: () => void;
  user: firebase.User;
  userImage: string | null;
}> {
  public state = {
    resetDisabled: false,
    verifyDisabled: false,
    deleteConfirmOpen: false,
    linkedDiscord: null as null | LinkAccount,
  };

  async componentDidMount() {
    const token = await this.props.user.getIdToken();
    const response = await axios.get<LinkAccount[]>(
      serverPath + '/linkAccount',
      {
        params: {
          uid: this.props.user.uid,
          token,
        },
      }
    );
    const data = response.data;
    const linkedDiscord = data.find((d) => d.kind === 'discord');
    this.setState({ linkedDiscord });
  }

  onSignOut = () => {
    firebase.auth().signOut();
    window.location.reload();
  };

  resetPassword = async () => {
    try {
      if (this.props.user.email) {
        await firebase.auth().sendPasswordResetEmail(this.props.user.email);
        this.setState({ resetDisabled: true });
      }
    } catch (e) {
      console.warn(e);
    }
  };

  verifyEmail = async () => {
    try {
      if (this.props.user) {
        await this.props.user.sendEmailVerification();
        this.setState({ verifyDisabled: true });
      }
    } catch (e) {
      console.warn(e);
    }
  };

  deleteAccountConfirm = () => {
    this.setState({ deleteConfirmOpen: true });
  };

  deleteAccount = async () => {
    const token = await this.props.user.getIdToken();
    await window.fetch(serverPath + '/deleteAccount', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid: this.props.user.uid, token }),
    });
    window.location.reload();
  };

  authDiscord = () => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=1071707916719095908&redirect_uri=${encodeURIComponent(
      process.env.REACT_APP_OAUTH_REDIRECT_HOSTNAME ??
        'https://www.watchparty.me'
    )}%2Fdiscord%2Fauth&response_type=token&scope=identify`;
    window.open(
      url,
      '_blank',
      'toolbar=0,location=0,menubar=0,width=450,height=900'
    );
  };

  deleteDiscord = async () => {
    const token = await this.props.user.getIdToken();
    await window.fetch(serverPath + '/linkAccount', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: this.props.user.uid,
        token,
        kind: 'discord',
      }),
    });
    window.location.reload();
  };

  render() {
    const { close, userImage } = this.props;
    return (
      <Modal open={true} onClose={close as any} size="tiny">
        <Modal
          open={this.state.deleteConfirmOpen}
          onClose={() => {
            this.setState({ deleteConfirmOpen: false });
          }}
          size="tiny"
        >
          <Modal.Header>Delete Your Account</Modal.Header>
          <Modal.Content>
            <p>
              Are you sure you want to delete your account? This can't be
              undone.
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              positive
              onClick={async () => {
                await this.deleteAccount();
              }}
            >
              Yes
            </Button>
            <Button
              negative
              onClick={() => {
                this.setState({ deleteConfirmOpen: false });
              }}
            >
              No
            </Button>
          </Modal.Actions>
        </Modal>
        <Modal.Header>
          <Image avatar src={userImage} />
          {this.props.user.email}
          {this.props.user.emailVerified && (
            <Icon
              style={{ marginLeft: '8px' }}
              title="Thie email is verified"
              name="check circle"
            ></Icon>
          )}
        </Modal.Header>
        <Modal.Content>
          <div
            style={{
              width: '300px',
              display: 'flex',
              alignItems: 'center',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <Button
              icon
              labelPosition="left"
              fluid
              href="https://gravatar.com"
              target="_blank"
              color="blue"
            >
              <Icon name="image" />
              Edit Gravatar
            </Button>
            <Button
              disabled={
                this.props.user.emailVerified || this.state.verifyDisabled
              }
              icon
              labelPosition="left"
              fluid
              color="purple"
              onClick={this.verifyEmail}
            >
              <Icon name="check circle" />
              Verify Email
            </Button>
            {this.state.linkedDiscord ? (
              <Button
                icon
                labelPosition="left"
                fluid
                color="red"
                animated="fade"
                onClick={this.deleteDiscord}
              >
                <Icon name="discord" />
                Unlink Discord {this.state.linkedDiscord.accountname}#
                {this.state.linkedDiscord.discriminator}
              </Button>
            ) : (
              <React.Fragment>
                <Popup
                  content="Link your Discord account to automatically receive your Subscriber role if you're subscribed"
                  trigger={
                    <Button
                      icon
                      labelPosition="left"
                      fluid
                      color="orange"
                      onClick={this.authDiscord}
                    >
                      <Icon name="discord" />
                      Link Discord Account
                    </Button>
                  }
                />
              </React.Fragment>
            )}
            <Button
              disabled={this.state.resetDisabled}
              icon
              labelPosition="left"
              fluid
              color="green"
              onClick={this.resetPassword}
            >
              <Icon name="key" />
              Reset Password
            </Button>
            <Button
              icon
              labelPosition="left"
              fluid
              color="red"
              onClick={this.deleteAccountConfirm}
            >
              <Icon name="trash" />
              Delete Account
            </Button>
            <Button icon labelPosition="left" onClick={this.onSignOut} fluid>
              <Icon name="sign out" />
              Sign out
            </Button>
          </div>
        </Modal.Content>
      </Modal>
    );
  }
}
