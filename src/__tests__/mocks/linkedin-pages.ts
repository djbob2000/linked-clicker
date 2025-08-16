/**
 * Mock LinkedIn page HTML structures for testing automation logic
 */

export const MOCK_LINKEDIN_HOME_PAGE = `
<!DOCTYPE html>
<html>
<head>
    <title>LinkedIn: Log In or Sign Up</title>
</head>
<body>
    <div class="main-content">
        <div class="nav__button-secondary">
            <a href="/login" class="nav__cta-container" data-tracking-control-name="guest_homepage-basic_nav-header-signin">
                Sign in
            </a>
        </div>
        <div class="hero-section">
            <h1>Welcome to your professional community</h1>
        </div>
    </div>
</body>
</html>
`;

export const MOCK_LINKEDIN_LOGIN_PAGE = `
<!DOCTYPE html>
<html>
<head>
    <title>LinkedIn Login</title>
</head>
<body>
    <div class="login-form">
        <form class="login__form" action="/uas/login-submit" method="post">
            <div class="login__form_input_container">
                <input 
                    id="username" 
                    name="session_key" 
                    type="text" 
                    placeholder="Email or Phone"
                    required
                />
            </div>
            <div class="login__form_input_container">
                <input 
                    id="password" 
                    name="session_password" 
                    type="password" 
                    placeholder="Password"
                    required
                />
            </div>
            <button type="submit" class="btn__primary--large">
                Sign in
            </button>
        </form>
    </div>
</body>
</html>
`;

export const MOCK_LINKEDIN_LOGIN_ERROR_PAGE = `
<!DOCTYPE html>
<html>
<head>
    <title>LinkedIn Login</title>
</head>
<body>
    <div class="login-form">
        <div class="form__input--error">
            <div class="form__input--error-text">
                Please check your email and password and try again.
            </div>
        </div>
        <form class="login__form" action="/uas/login-submit" method="post">
            <div class="login__form_input_container">
                <input 
                    id="username" 
                    name="session_key" 
                    type="text" 
                    placeholder="Email or Phone"
                    class="form__input--error"
                    required
                />
            </div>
            <div class="login__form_input_container">
                <input 
                    id="password" 
                    name="session_password" 
                    type="password" 
                    placeholder="Password"
                    class="form__input--error"
                    required
                />
            </div>
            <button type="submit" class="btn__primary--large">
                Sign in
            </button>
        </form>
    </div>
</body>
</html>
`;

export const MOCK_LINKEDIN_FEED_PAGE = `
<!DOCTYPE html>
<html>
<head>
    <title>LinkedIn Feed</title>
</head>
<body>
    <div class="global-nav">
        <nav class="global-nav__nav">
            <ul class="global-nav__primary-items">
                <li class="global-nav__primary-item">
                    <a href="/feed/">Home</a>
                </li>
                <li class="global-nav__primary-item">
                    <a href="/mynetwork/">My Network</a>
                </li>
            </ul>
        </nav>
    </div>
    <div class="feed-container">
        <h1>LinkedIn Feed</h1>
        <div class="feed-content">
            <p>Welcome to your LinkedIn feed!</p>
        </div>
    </div>
</body>
</html>
`;

export const MOCK_LINKEDIN_NETWORK_GROWTH_PAGE = `
<!DOCTYPE html>
<html>
<head>
    <title>Grow your network - LinkedIn</title>
</head>
<body>
    <div class="global-nav">
        <nav class="global-nav__nav">
            <ul class="global-nav__primary-items">
                <li class="global-nav__primary-item">
                    <a href="/mynetwork/">My Network</a>
                </li>
            </ul>
        </nav>
    </div>
    <div class="network-growth-container">
        <h1>Grow your network</h1>
        <div class="cohort-section">
            <h2>People you may know</h2>
            <button 
                class="cohort-section__see-all-btn"
                data-view-name="cohort-section-see-all"
                type="button"
            >
                See all
            </button>
        </div>
    </div>
</body>
</html>
`;

export const MOCK_LINKEDIN_CONNECTION_MODAL = `
<!DOCTYPE html>
<html>
<head>
    <title>People you may know - LinkedIn</title>
</head>
<body>
    <div class="global-nav">
        <nav class="global-nav__nav">
            <ul class="global-nav__primary-items">
                <li class="global-nav__primary-item">
                    <a href="/mynetwork/">My Network</a>
                </li>
            </ul>
        </nav>
    </div>
    
    <div class="artdeco-modal" data-testid="dialog">
        <div class="artdeco-modal__content">
            <h2>People you may know</h2>
            <div class="search-results-container">
                <ul class="reusable-search__entity-result-list">
                    <li class="reusable-search__result-container" role="listitem">
                        <div class="entity-result">
                            <div class="entity-result__content">
                                <div class="entity-result__primary-subtitle">
                                    <span class="entity-result__primary-subtitle-text">
                                        Software Engineer at TechCorp
                                    </span>
                                </div>
                                <div class="entity-result__summary">
                                    <p class="entity-result__summary-text">
                                        John and 12 other mutual connections
                                    </p>
                                </div>
                            </div>
                            <div class="entity-result__actions">
                                <button 
                                    class="artdeco-button artdeco-button--2 artdeco-button--primary"
                                    data-control-name="srp_profile_actions"
                                >
                                    <span>Connect</span>
                                </button>
                            </div>
                        </div>
                    </li>
                    
                    <li class="reusable-search__result-container" role="listitem">
                        <div class="entity-result">
                            <div class="entity-result__content">
                                <div class="entity-result__primary-subtitle">
                                    <span class="entity-result__primary-subtitle-text">
                                        Product Manager at StartupXYZ
                                    </span>
                                </div>
                                <div class="entity-result__summary">
                                    <p class="entity-result__summary-text">
                                        Jane and 8 other mutual connections
                                    </p>
                                </div>
                            </div>
                            <div class="entity-result__actions">
                                <button 
                                    class="artdeco-button artdeco-button--2 artdeco-button--primary"
                                    data-control-name="srp_profile_actions"
                                >
                                    <span>Connect</span>
                                </button>
                            </div>
                        </div>
                    </li>
                    
                    <li class="reusable-search__result-container" role="listitem">
                        <div class="entity-result">
                            <div class="entity-result__content">
                                <div class="entity-result__primary-subtitle">
                                    <span class="entity-result__primary-subtitle-text">
                                        Designer at CreativeAgency
                                    </span>
                                </div>
                                <div class="entity-result__summary">
                                    <p class="entity-result__summary-text">
                                        Bob and 3 other mutual connections
                                    </p>
                                </div>
                            </div>
                            <div class="entity-result__actions">
                                <button 
                                    class="artdeco-button artdeco-button--2 artdeco-button--primary"
                                    data-control-name="srp_profile_actions"
                                >
                                    <span>Connect</span>
                                </button>
                            </div>
                        </div>
                    </li>
                    
                    <li class="reusable-search__result-container" role="listitem">
                        <div class="entity-result">
                            <div class="entity-result__content">
                                <div class="entity-result__primary-subtitle">
                                    <span class="entity-result__primary-subtitle-text">
                                        Marketing Director at BigCorp
                                    </span>
                                </div>
                                <div class="entity-result__summary">
                                    <p class="entity-result__summary-text">
                                        Alice and 15 other mutual connections
                                    </p>
                                </div>
                            </div>
                            <div class="entity-result__actions">
                                <button 
                                    class="artdeco-button artdeco-button--2 artdeco-button--primary"
                                    data-control-name="srp_profile_actions"
                                >
                                    <span>Connect</span>
                                </button>
                            </div>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>
`;

export const MOCK_LINKEDIN_CONNECTION_SENT_MODAL = `
<!DOCTYPE html>
<html>
<head>
    <title>People you may know - LinkedIn</title>
</head>
<body>
    <div class="global-nav">
        <nav class="global-nav__nav">
            <ul class="global-nav__primary-items">
                <li class="global-nav__primary-item">
                    <a href="/mynetwork/">My Network</a>
                </li>
            </ul>
        </nav>
    </div>
    
    <div class="artdeco-modal" data-testid="dialog">
        <div class="artdeco-modal__content">
            <h2>People you may know</h2>
            <div class="search-results-container">
                <ul class="reusable-search__entity-result-list">
                    <li class="reusable-search__result-container" role="listitem">
                        <div class="entity-result">
                            <div class="entity-result__content">
                                <div class="entity-result__primary-subtitle">
                                    <span class="entity-result__primary-subtitle-text">
                                        Software Engineer at TechCorp
                                    </span>
                                </div>
                                <div class="entity-result__summary">
                                    <p class="entity-result__summary-text">
                                        John and 12 other mutual connections
                                    </p>
                                </div>
                            </div>
                            <div class="entity-result__actions">
                                <button 
                                    class="artdeco-button artdeco-button--2 artdeco-button--secondary"
                                    disabled
                                >
                                    <span>Pending</span>
                                </button>
                            </div>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>
`;

/**
 * Helper function to create a mock page with specific content
 */
export function createMockLinkedInPage(content: string): string {
  return content;
}

/**
 * Mock page configurations for different test scenarios
 */
export const MOCK_PAGE_CONFIGS = {
  HOME: {
    url: 'https://www.linkedin.com/home',
    html: MOCK_LINKEDIN_HOME_PAGE,
  },
  LOGIN: {
    url: 'https://www.linkedin.com/login',
    html: MOCK_LINKEDIN_LOGIN_PAGE,
  },
  LOGIN_ERROR: {
    url: 'https://www.linkedin.com/login',
    html: MOCK_LINKEDIN_LOGIN_ERROR_PAGE,
  },
  FEED: {
    url: 'https://www.linkedin.com/feed/',
    html: MOCK_LINKEDIN_FEED_PAGE,
  },
  NETWORK_GROWTH: {
    url: 'https://www.linkedin.com/mynetwork/grow/',
    html: MOCK_LINKEDIN_NETWORK_GROWTH_PAGE,
  },
  CONNECTION_MODAL: {
    url: 'https://www.linkedin.com/mynetwork/grow/',
    html: MOCK_LINKEDIN_CONNECTION_MODAL,
  },
  CONNECTION_SENT: {
    url: 'https://www.linkedin.com/mynetwork/grow/',
    html: MOCK_LINKEDIN_CONNECTION_SENT_MODAL,
  },
};

/**
 * Expected connection data from mock pages
 */
export const MOCK_CONNECTION_DATA = [
  {
    name: 'John',
    mutualConnectionsCount: 12,
    title: 'Software Engineer at TechCorp',
  },
  {
    name: 'Jane',
    mutualConnectionsCount: 8,
    title: 'Product Manager at StartupXYZ',
  },
  {
    name: 'Bob',
    mutualConnectionsCount: 3,
    title: 'Designer at CreativeAgency',
  },
  {
    name: 'Alice',
    mutualConnectionsCount: 15,
    title: 'Marketing Director at BigCorp',
  },
];
