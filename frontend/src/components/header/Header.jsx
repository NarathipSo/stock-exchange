import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser } from '@fortawesome/free-solid-svg-icons'
import './Header.css'

const Header = () => {
  return (
    <header className='header'>
      <h1 id='icon'>Trading Engine</h1>
      <FontAwesomeIcon icon={faUser} id='user-icon' />
    </header>
  );
}

export default Header